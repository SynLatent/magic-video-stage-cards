# 卡内工具

- `check-classes.mjs`：类名覆盖检查（下文）。
- `sample-frames.mjs`：独立小样取帧（文末）。

## 类名覆盖检查

登记 Draft 前运行，检查 JS 运行时创建的节点是否有样式契约。JS 创建或赋值的类名缺少定义时报错；HTML 静态类名缺少定义只作提示。

### 用法

需要 Node ≥ 18。在本目录运行：

```sh
node check-classes.mjs <工程目录> [--rig <stage-rig.js 路径>]
```

### 检查规则

1. 只使用 `node:fs`、`node:path`、`node:process`，无第三方依赖。不读取时钟，不使用随机数、定时器或网络。
2. 递归收集工程内的 `*.html`、`*.js` 作为使用方，`*.css` 和 JS 字符串中的选择器作为定义方。跳过 `runtime/`、`vendor/`、`node_modules/`、`.runtime/`。另读 `--rig` 指定文件作为定义方；默认读取工程内 `runtime/stage-rig.js`，默认文件不存在则跳过。
3. 提取 HTML 的 `class="a b"`，JS 的 `className = "a b"`、`className: "a"`、`classList.add("a","b")`。第二参数为类串的调用只认 `el`、`make`、`node` 或以 `create` 开头的调用名，支持 `K.el(...)`、`kit.el(...)` 等前缀。单双引号均可。`"icon " + (cls || "")` 这类拼接只取开头字面量，不推导变量值。`setAttribute("d", "M" + ...)` 不算类名创建调用。
4. CSS 与 rig 文本按 `\.([a-zA-Z_][\w-]*)` 提取类名。工程 JS 字符串中以点开头、符合该模式的片段也算定义，包括查询、动画选择器里的类名；仅作 JS 钩子的结构类因此可被覆盖。这是静态文本检查，不执行工程代码，不计算选择器优先级或运行时样式。
5. JS 创建或赋值的类名缺少定义时，按文件、类名排序报错，退出 1。HTML 静态 `class="..."` 缺少定义只输出「提示」，不影响退出码；HTML 内联脚本中的 JS 创建或赋值仍按错误检查。没有 JS 缺失时，首行打印 `ok: N classes covered`，退出 0，随后输出提示。N 是使用方已被定义覆盖的去重类名数，不包含仅作提示的缺失静态类名。单类选择器的声明块含 `visibility:hidden` 时，仍提示「子节点需显式写回 visible」，不影响退出码。参数或读取失败退出 1。

### 自测

以下命令在卡片目录的上一级运行。对自己的工程目录跑一次，类名都有定义时退出 0，首行为 `ok: N classes covered`；允许随后列出静态类名提示。

```sh
node stage-full/tools/check-classes.mjs <工程目录> --rig stage-full/assets/stage-rig/stage-rig.js; echo exit=$?
```

下一条使用已建立并授权可写的夹具目录。先把 `FIXTURE_B` 设置为该目录，再执行。预期 `a.js` 的 `gate-panel` 出现在错误行，`index.html` 的 `scene` 出现在提示行，退出 1。

```sh
printf '<div class="scene"></div>' > "${FIXTURE_B:?}/index.html" &&
printf 'el("div","gate-panel",root);' > "${FIXTURE_B:?}/a.js" &&
: > "${FIXTURE_B:?}/style.css" &&
node stage-full/tools/check-classes.mjs "${FIXTURE_B:?}"
echo exit=$?
```

## 独立小样取帧

给 Work 的 `materials/tests/<名>/` 这类单文件合成用，不经 Studio、不登记 Draft。按给定时刻 seek 主时间线截 PNG，每个时刻再经「0 → 片尾 → 该时刻」重 seek 一次比对像素，并报告页面错误、出画的文字与单帧 seek 耗时。正式工程用 `preview diagnose --range … --frames`，不用本工具。

```sh
node sample-frames.mjs <小样目录> <输出目录> --times 0,2.5,7 [--timeline main] [--browser <chrome>] [--puppeteer <puppeteer-core 目录>]
```

- 小样目录要有 `index.html`，一条 paused GSAP 主时间线注册到 `window.__timelines`；`--timeline` 缺省取根 `data-composition-id`，再取第一条。
- 浏览器缺省取 `HYPERFRAMES_BROWSER_PATH`；puppeteer-core 缺省从小样目录和本工具目录向上找 `runtime/npm/node_modules/puppeteer-core`（部署包布局）。
- 浏览器配置放系统临时目录，结束即删；网络盘或 9p 上的 profile 会让 Chromium 启动即退出。
- seek 用 `seek(t, false)`，由 `onUpdate` 驱动的 WebGL 背景也按该时刻重画。
- 输出目录写 `t<秒>.png`、重 seek 不一致时的 `-reseek.png` 与 `qa.json`；标准输出一行摘要。退出码：0 无错误；1 页面错误、重 seek 不一致、参数或启动失败。出画文字只作提示（`textOutsideAt`）。
- 帧只给执行者自己看，不作交付或审片证据，不入卡仓。

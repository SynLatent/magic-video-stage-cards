# 纸艺舞台卡：stage-full / stage-light

两张「纸艺微缩舞台」风格的 HyperFrames 视频设计卡。画面是一座会折叠、会换景的小纸舞台：
纸板墙立起、道具从台面翻起、光池扫过、物件落进托盘，把「观察 → 分组 → 解释」演成动作，
而不是一页页翻幻灯片。

| 卡 | 定位 |
|---|---|
| `stage-full` | 完整版：折叠布景 `stage-rig`、11 个舞台积木 `stage-kit`、纸艺动作包 `stage-motion`、背景轨 / 前景轨分工、自看循环与自检清单 |
| `stage-light` | 轻量版：同一纸艺画风，只开两页背板，复用 `stage-full` 的布景与动作包，不带积木 |

所有道具与布景都是原创内联 SVG / CSS 剪贴；卡内脚本无第三方依赖，状态全部是时间 `t` 的纯函数，任意 seek 结果一致。

版本：`stage-full` v9、`stage-light` v4，变更见各卡 `CHANGELOG.md`。

## 目录

```
designs/stage-full/
  design.json                 卡片声明（Magic Video 设计卡格式）
  GUIDE.md                    设计指南：分轨、分层、铰链归属、声音、六种做坏方式、积木清单
  MOTION.md                   动作清单：7 个前景动作 + 3 个背景动作
  stages/                     各阶段写法（research / script / plan / draft / export）
  ANIMATION_PLAN.template.md  Plan 模板（含「轨道镜头表」）
  assets/stage-rig/           折叠布景机制与全屏纸板背景（HarnessStageRig）
  assets/stage-kit/           11 个舞台积木（HarnessStageKit），每个积木一份 .md 参数合同
  assets/stage-motion/        本卡动作包：HarnessMotion 动词的纸艺实现，外加 sortTo 归位
  tools/                      check-classes.mjs 类名覆盖检查、sample-frames.mjs 小样取帧
designs/stage-light/          轻量版：声明与文档，资产引用 stage-full
runtime/
  motion.js                   HarnessMotion：6 个标准动作动词的运行时，卡片动作包挂在它上面
  scene-binding.js            HarnessScene.bindScene：把 renderAt(t) 接到 HyperFrames 的 hf-seek
spec/                         卡片阶段文档引用的 Magic Video 通用规范副本，只供阅读
AGENTS.md                     给 AI 编码助手的使用说明与硬规则
```

本包不含示范工程、字体、GSAP、位图与音频。

## 用法一：在 Magic Video 里

1. 把 `designs/stage-full/` 与 `designs/stage-light/` 一起放进设计卡目录（配置的 `design_root`）；`stage-light` 引用 `stage-full` 的资产，不能单独放。
2. `work design validate` 校验两张卡。
3. 新建 Work 时用 `--design stage-full`（或 `stage-light`）。
4. 按需安装卡内资产：`work --work <id> --variant <id> component install stage-full/<资产> --binding-file <binding.json>`，资产为 `stage-rig`、`stage-kit`、`stage-motion`；加载顺序见 `stage-full/GUIDE.md` §10。

`runtime/` 与思源黑体由 Magic Video 自带，本包的 `runtime/` 只是同版本副本。

## 用法二：在任意网页或 HyperFrames 合成里

卡内脚本和 `runtime/` 不依赖 GSAP 或其他库。按下面顺序加载，用到哪个就加载哪个：

```
runtime/motion.js
designs/stage-full/assets/stage-rig/stage-rig.js
designs/stage-full/assets/stage-kit/stage-kit.js      （用积木时）
designs/stage-full/assets/stage-kit/blocks/<积木>.js  （用到的积木）
designs/stage-full/assets/stage-motion/stage-motion.js
你的工程脚本
```

最小例子：纸板背景展开，三个纸盒立起，一个归位，最后退场收起。

```html
<div id="stage" style="position:relative;width:1920px;height:1080px;overflow:hidden">
  <div id="bg" style="position:absolute;inset:0"></div>
  <div id="fg" style="position:absolute;inset:0">
    <div class="box" style="position:absolute;left:640px;top:560px;width:160px;height:160px;background:#e59a2e"></div>
    <div class="box" style="position:absolute;left:880px;top:560px;width:160px;height:160px;background:#e0563c"></div>
    <div class="box" style="position:absolute;left:1120px;top:560px;width:160px;height:160px;background:#4c8fbf"></div>
  </div>
</div>
<script src="runtime/motion.js"></script>
<script src="designs/stage-full/assets/stage-rig/stage-rig.js"></script>
<script src="designs/stage-full/assets/stage-motion/stage-motion.js"></script>
<script>
  var backdrop = HarnessStageRig.createBackdrop({ mount: document.getElementById('bg'), horizon: 700,
    skins: { warm: { wall: ['#f7ecd8', '#e6cfa8'], floor: ['#dcbd8e', '#c49a63'] } } });
  var motion = HarnessMotion.create({ card: 'stage-full' });
  var boxes = Array.from(document.querySelectorAll('.box'));
  backdrop.unfold({ at: 0.2 });
  motion.appear(boxes, { at: 2.4, stagger: { span: 0.3 } });
  motion.sortTo(boxes[1], { at: 4, to: { x: 0, y: -120 } });
  motion.exit(boxes, { at: 6.5 });
  backdrop.fold({ at: 7.2 });
  function renderAt(t) { backdrop.apply(t); motion.apply(t); }
  renderAt(5);   // 任意秒数都能直接重建画面
</script>
```

- **接 HyperFrames**：根 composition 注册一条 paused GSAP 主时间线到 `window.__timelines`，再加载 `runtime/scene-binding.js`，用 `HarnessScene.bindScene({ duration, timeline, renderAt })` 把 seek 交给 `renderAt`。`design.json` 为宿主声明了 `gsap ^3.14` 与 `MotionPathPlugin`。
- **其他播放器**：在自己的时钟或拖动条回调里调用 `renderAt(秒数)` 即可。
- **字体**：中文需要思源黑体 CN（[Source Han Sans](https://github.com/adobe-fonts/source-han-sans)，SIL OFL 1.1，需自行下载）。文档默认路径为 `media/SourceHanSansCN-Regular.otf`，用 `@font-face` + `font-display: block`，等 `document.fonts.ready` 后再渲染首帧。

## 阅读顺序

1. `stage-full/GUIDE.md`：先看 §0 分轨与 §9 六种做坏方式。
2. `stage-full/MOTION.md`：动作名、参数与规则。
3. `stage-full/stages/plan.md`：「轨道镜头表」的写法与规则。
4. `stage-full/stages/draft.md`：自看循环、前端踩坑清单、前景自检。
5. 用到哪个积木，再读对应的 `assets/stage-kit/blocks/*.md`。

GUIDE 中的 `work …`、`preview diagnose`、`critic round` 等命令属于 Magic Video 工具链；脱离框架时把这些文档当作创作方法参考，自检改用 `tools/` 下的两个脚本。

## 许可

- 卡片、积木、动作包与 `runtime/`：Apache License 2.0（见 `LICENSE`）。
- 折叠与换景机制已授权提取，身份与许可见 `assets/*/asset.json`。
- 不随包分发：GSAP（遵循其自身许可）、思源黑体（SIL OFL 1.1）。

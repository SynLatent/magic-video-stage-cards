# stage-full · Draft 阶段指南

## 机制与实现

- 构件：卡内资产 `assets/stage-rig/stage-rig.js`（四块墙板、内对 ±86°、外板反向 ∓172°、地面桥 -90°、道具脚 88°，先内后外分级展开）。
- 四层：第 1 层 `background`、第 2 层 `stage`、第 3 层 `overlay`（`#spot-a/#spot-b`、因果指示线、吊灯横杆）、第 4 层 `text`；无第 5 层（示例静音）。
- 单一 paused 主时间线注册到 `window.__timelines['<composition-id>']`，同一条交给 `HarnessScene.bindScene`；无 RAF / play / autoplay / Date / Math.random。
- 外部 seek：seek 到 t 时直接重建完整状态，`dispose()` 解绑并 kill 时间线；不依赖 seek 事件或回调。

## 资源闭包、字体与释放

- 资源闭包：工程只依赖宿主放好的 `runtime/gsap.min.js`、`runtime/scene-binding.js`、`runtime/stage-rig.js` 与 `media/SourceHanSansCN-Regular.otf`；无图片、音频、字体下载与新依赖。Work 工程用自带的 `runtime/motion.js`，卡内资产用 `component install stage-full/<资产>` 装进 `vendor/components/stage-full/`，加载顺序见 GUIDE §10「动作与背景接入 Work」。
- 动作：前景物体的出现、退场、强调、移动、落定、换场与归位只用 [MOTION.md](../MOTION.md) 里的动作；换地点用背景动作 `refold`，前景在换景开始前退场、换景完成后再出现。
- 字体：`document.fonts.ready` 就绪后才首次渲染；`@font-face` 只指向 `media/SourceHanSansCN-Regular.otf`，`font-display:block`；不使用网络字体或系统回退排版。
- 布局：固定 1920×1080；五层各占一层，第 3 层不遮挡第 4 层正文；文字只在阅读窗口内保持稳定。

## 具体技术检查

- 确定性 seek：正放、倒放、随机 seek、重复 seek 一致；对 `[t3, 0, t1, t3]` 抓帧比较同一时刻。
- 释放：`dispose()` 解绑并 kill 时间线后不再响应 seek。
- 声音：示例静音；若某 Variant 需要音效，只为结构重击与关键 hit（如 S4 折叠落定、S3 归位轻点）配音效，不给普通入场自动配音效；BGM 只在开启 `bgm.enabled` 时用一条开源曲库导入的现成曲目，不合成 BGM；所有 cue 对应同帧可见事件并按 `data-start` 调度以保证 seek 安全。
- 不新增几何/函数预置、通用角色库、AI 概念图库或 BGM 生成。

## 自看循环（做每一段时）

执行者能看图时，构图与动作由执行者自己看帧判断。不要为了看一段帧就逐块登记 Draft、开全片 `critic round`、每次从 0 秒全片诊断并复验早已不变的段，那样只会堆出大量没有结论的帧包。只采样正在做的这一段：

- **开一次预览**：`preview open current --no-open`，整段工作期间保持开着；改源后 Studio 一般会自动重载，没重载时按下面「无效采样」处理。
- **取帧**：`preview diagnose current --range <段起> <段止> --frames`。要定点看，用 `--times a,b,c` 代替步长网格（每轮 ≤ 20 帧）。报告里：
  - `frames.directory` 下的 PNG 逐张用读图工具看；
  - `determinism` 是 `--times` 每个时刻经「0 → 片尾 → 该时刻」重 seek 后的像素比对，必须全部 `identical: true`，不一致的会另存 `-reseek.png`；
  - `stage.findings`（`stage_empty` / `stage_sparse`）、`still`、`css_contract`、`engineering` 只覆盖本段的 Scene；`scope` 写明实际范围。
- **预算**：每段最多 3 轮「改 → 取帧 → 看」；第 3 轮仍有问题，写进交付说明未处理项交给主控，不再盲改。
- **无效采样不算一轮**：`sampling.ready` 为 0（报告带 `hint`），或报 `detached Frame`、Studio 重载，先 `preview stop`、再 `preview open` 一次，然后重跑；连续两次无效就停下报告，不扩大排查。
- **段外不复验**：只改了本段，就不重采前面已过的段；全片诊断只在整片前景完成后跑一次。
- **帧不是证据**：自看帧在 Variant `.runtime/diagnose-frames/`，只留最近 3 次；不贴进交付说明当证据，不入卡仓。交付证据仍以登记的 Draft 与 `critic round` 为准。
- **独立小样**：X 光拆层、3D 舞台、WebGL 背景这类高难镜头，先在 Work 的 `materials/tests/<名>/` 写一个独立合成（无声、≤ 30 s、一条 paused 主时间线注册到 `window.__timelines`），用 `node <卡>/tools/sample-frames.mjs <小样目录> <小样目录>/frames --times …` 自看，成立后再并入工程。小样一次只推进一步（例如先拆层，再接背景，再接转场），每步有时间盒。

## 前端踩坑清单

- **3D 被压平**：`preserve-3d` 子树里任何祖先 `opacity < 1`、`filter` 或 `overflow` 裁剪都会把 3D 压平。压暗用不透明暗色，不用半透明；层片厚度用硬投影，不加背板（背板会在恢复不透明时穿出上层）。
- **真 3D 叠层**：perspective 容器 → 旋转容器 → 各层 `translateZ`；抽出一层是该层自己的位移与转正，其余层不动；所有状态是时刻 t 的纯函数。
- **拖动不一致**：同一属性只归一个 tween 或一个 `apply(t)`；`from()` / `set()` 回拖不还原，改 `fromTo()` 或纯函数。`determinism` 报不一致，先查这一条。
- **SVG**：GSAP 动画的 SVG 组不设 `transform-box: fill-box`。
- **自定义数据**：不要存到 `el.dir`、`el.title`、`el.hidden` 等原生属性名上，用 `dataset`。
- **中文字体**：所有可能含中文的文字（含英文等宽标签、层名牌）`font-family` 最后都落到 SourceHanSansCN，否则显示方框。
- **字不出画**：字幕和第 4 层文字任何时刻完整在画内；`sample-frames.mjs` 报 `textOutsideAt`，Studio 帧里看底边。
- **滤镜态的角色**：X 光、冷色调这类处理下角色仍要认得出：保留原图，叠冷色与发光轮廓，不做成灰剪影。
- **层宿主不吃命中测试**：全屏的层宿主写 `pointer-events: none`，直接子节点恢复 `auto`（积木核心已注入，手写宿主照同样写法）；否则第 3、4 层宿主盖住全画面，诊断把台上的物都判成被遮挡，报出大量 `rhythm_gap` 提示。
- **积木字号**：`slot.text` 默认 40 px；`sign.plate` 用 `style.size`；`inset.broll` 标注用 `label.size`。不要因为积木文档没细读就手写替身。

## 前景自检（整片登记 Draft 前做）

自检只定位问题、不判通过、不新增审批门；三道人工门以 workflow 为准。修不了的项逐条写进交付说明未处理项，与 `rhythm_gap` 的处理方式一致。

- **先静后动**：先把每个 Scene 写成停在结束状态的静态构图，按「自看循环」取帧自己看构图；主物大小、位置定下来再补动作。执行者看不了图时，登记一次 Draft，用 `critic round` 帧条请能看图的一方（用户或 critic）看，不要自己判断构图是否成立。
- **三帧核对**：每个 Scene 用 `--times` 取段首 +0.5 s、中段、段尾 −0.5 s 三帧。主物不在画里、只剩文字卡，或主物明显小于台面区的 40%，就回改。自看帧不作交付证据，不入卡仓。
- **覆盖率线索**：`preview diagnose` 报告的 `stage.findings` 里，`stage_sparse` 是前景（第 2 层，扣除 `data-hf-set` 布景件）覆盖率低于本卡阈值的区间，`stage_empty` 是舞台层完全空。按 plan「规则」第 2 条回改。
- **计算样式抽查**：本镜应在画里的物，其第 2 层节点的 `visibility` 为 `visible`、`position` 为 `absolute`（被 B 接管而隐藏或虚化的 A 组不在此列）；用默认背景时 `.hf-rig` 节点必须存在。用 `getComputedStyle` 核对实际值，不以代码存在代替。
- **可见性归属**：`.scene` 这类容器若写 `visibility:hidden`，子节点必须由同一函数统一写回 `visible`；只改 `opacity` 的节点会被继承隐藏。积木节点经 `kit.shown` 已成对写入。
- **类名覆盖**：JS 里创建的每个类名必须有样式契约：在工程 `style.css` 或 rig 注入的 CSS 中有规则，或在 JS 里被当作选择器引用。跑 `node tools/check-classes.mjs <工程目录>`，退出码非 0 先修正；结果写进交付说明。积木自带 CSS，工程只需保证自己新建的类名有规则。
- **道具自由**：本期专属的物用 `prop.states` 描述，也可以手写；手写节点同样过类名覆盖与计算样式。积木只是工具，不要为了用积木把物换成纸框、牌子或光。
- **位图规则**：常驻位图只允许台口（幕布、台唇）与背景轨布景；生图道具用带 alpha 的镂空图，带背景的方图进 `inset.broll` 纸框、`prop.states` 的 `alpha:false` 纸片或墙面贴纸；写实件不得压在阅读区上方。
- **声音**：只给 rig 落定、归位、盖章配音效；入场不配音；BGM 只按 `bgm.enabled` 与 `bgm.policy` 用开源曲库现成曲目，与 `GUIDE.md` §8 一致。

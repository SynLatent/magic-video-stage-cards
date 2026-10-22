# stage-full 设计卡指南

一句话：在一座小型纸舞台上，用**同一次折叠装置**把「观察 → 分组 → 解释」演成动作，
而不是一页页换幻灯片。§2–§4 描述一段 16 秒的示范编排，**不是口播时间证据**：2 / 6 / 11 / 15 秒是可读检查点，
不是口播对齐或真实语音时间。

本包不带示范工程与字体，示范编排只以文字给出，用作写法参考。工程运行需要宿主提供 `runtime/gsap.min.js`、
`runtime/scene-binding.js`、卡内资产与思源黑体 `media/SourceHanSansCN-Regular.otf`；Work 里的接线见 §10「动作与背景接入 Work」。

## 0. 分轨：背景轨与前景轨

本卡按层分工。

- **背景轨**：第 1 层、rig 布景件（墙板、地面）与换景动作。
  - **默认背景**：标准背景动作，即 `HarnessStageRig.createBackdrop` 的全屏纸板：展开后背板铺满地平线以上、台面铺满地平线以下，单层、不垫第二层底；开场 `unfold`，换地点 `refold`（折起、换皮、原地展开），收尾 `fold`（见 [MOTION.md](MOTION.md)「背景动作」）。按默认使用即可，不需要另做设计。
  - **进阶背景**：有自备布景位图时用 `disc.scene` 加 `board`：圆盘半周换景，转正后纸板展开铺满全屏，小素材再逐件落上去，三个动作在同一层背景里。用了进阶就不再另放 `createBackdrop`。旧的 `rig.rebuild`（舞台式纸布景、整台后退重搭）仍可用，但不是默认。
  - **定制背景**：按 Work 设计，可以整体替换默认背景，只要守住下面的接口。执行者要能按「自看循环」自己看帧：先在 Work 的 `materials/tests/<名>/` 做成独立小样、自看通过，再并入工程；无法看帧时仍用默认背景。
  - **背景给前景的接口**：台面区（默认 x 120–1800、y 200–900，字幕安全带以上）；换景时刻清单（前景在换景开始前退场，换景完成后入场）；布景件带 `data-hf-set`（stage-rig 的墙板与地面已自带），诊断据此把布景与前景分开。
  - **WebGL / 粒子背景**（银河、黑洞、虚空这类）：全屏 canvas 固定 1920×1080，放在第 1 层，不进前景 3D 叠层、不随叠层旋转；只由主时间线驱动（时间线 `onUpdate` 里按当前时刻 `render`），不用 rAF、Date、`Math.random`（随机用固定种子）；`window.__timelines` 仍只注册一条。无 GPU 时 Studio 与渲染走 SwiftShader，先实测单帧耗时，预算约 250 ms：逐像素着色器先降内部分辨率（满分辨率可能要数秒一帧，降到约 0.35 倍通常回到预算内）再降步数；GLSL 里注入的数字一律带小数点（int 字面量不能初始化 `const float`）。
- **前景轨**：第 2 层的物与道具、第 3 层强调、第 4 层文字。按下面的顺序走，只读本节、`stages/plan.md`、`stages/draft.md`，用到哪个积木再读它的 `blocks/*.md`：
  1. 写画面表（`stages/plan.md`「轨道镜头表」）：每个 Scene 先用一句话说清主物、它做什么、结束时什么样，再逐镜填表；
  2. 本期专属的物（闸门、卡纸堆、抽屉……）用 `prop.states` 写成多部件、多状态的道具，通用动作（立起、纸框、写牌、光、托盘、剖切、阅读窗）用对应积木；
  3. 先静后动：先让每个 Scene 停在结束状态，用 `preview diagnose --range … --times … --frames` 取这一段的帧，自己看构图，主物大小、位置定下来再补动作；
  4. 自看循环（`stages/draft.md`「自看循环」）：每做完一段，只采样这一段、自己读图修正，不为取帧登记 Draft、不开 `critic round`、不重跑全片诊断；高难镜头先在 Work 的 `materials/tests/<名>/` 做独立小样，用 `tools/sample-frames.mjs` 自看，成立后再并入工程；
  5. 整片前景做完：登记一次 Draft，跑一次全片 `preview diagnose` 与登记前自检（`stages/draft.md`「前景自检」），再 `critic round` 交独立审片，用 `critic record` 记录实际结论；修不了的逐项写进交付说明未处理项。自检与审片只定位问题，不新增审批门；三道人工门以 workflow 为准。

  执行者无法看图时，第 3、4 步改为登记 Draft，请能看图的一方（用户或 critic）看帧条。

## 1. 来源机制（授权提取）

| 来源 | 机制 | 本卡如何用 |
|---|---|---|
| 折叠装置机制 | `.set` perspective > slide > wall + floor + props：四块 480px 墙板铺满 1920；内对锚在中线 folding ±86°；外板挂在内板上、反向 ±172°；先内后外分级展开并锁定；地面桥绕上边从 -90° 立起；道具脚绕上边从 88° 立起。旧景道具先塌、外/内板再折、整台后退，新地点在视野里搭起。父级 rig 拥有铰链旋转，scene inner wrapper 拥有其他变换 | 共享机制全部落在卡内资产 `assets/stage-rig/stage-rig.js`，工程脚本只喂 `{inner, outer, floor, prop}` |
| 圆盘换景与逐件装配机制 | 一个刚性 4400 px 圆盘、两半各载一景、每次整盘转 180°、转正后按件类型（地板立起 / 天幕落下 / 墙板立起 / 梁架下降 / 道具侧入 / 悬挂件下降）0.65 s 冲击 + 0.16 s 回弹逐件装配 | 卡内资产 `assets/stage-kit/blocks/disc-scene.js`，机制已授权提取，布景位图由工程自备，不随卡配送 |
| 舞台方向 | 台口小、内容聚焦；幕布只做开场/收尾；无逐段整幕擦除、无常驻侧房；不拿整体淡出/平移替代折叠重建 | 幕布只在 0.80 开、15.40 合；重建是一次真实折叠 |
| 分层舞台机制 | 微型分层舞台（后墙 / 布景 / 主体 / 前景 / 标牌 / 灯光）；幕布开场收尾；因果道具交接与引导光池；剪贴白边 + 偏移投影 | 第 1–4 层分层、`#spot-a/#spot-b` 两支光池、托盘因果指示线、纸盒白边 + `drop-shadow` + 偏移 `box-shadow` |
| 交错入场机制 | 交错入场与空间对比，用实际动作完成转场 | 六个纸盒交错入场、两簇空间对比、重建由折叠动作完成 |

获授权只读提取的机制身份与许可见卡内资产 `assets/stage-rig/asset.json`；不配送原作品或私人媒体。

## 2. 分层与固定画幅

- 根 composition：`#stage-full-example`，`data-composition-id="stage-full-example"`，
  `data-width/data-height=1920/1080`，`data-duration=16`。
- 第 1 层 `background`：剧场底色与暗角。
- 第 2 层 `stage`：折叠装置 `#rig`、墙面标识卡、两格托盘、六个纸盒、立牌道具、解释标签。
- 第 3 层 `overlay`：`#spot-a/#spot-b` 焦点光、六条因果指示线、吊灯横杆。
- 第 4 层 `text`：步骤标签、说明句、三步回顾。
- 无第 5 层：示例静音、无口播，故不生成字幕宿主。

## 3. 折叠与铰链归属

- 工程 `style.css` 只给纸艺皮肤；几何与角度全部来自 `assets/stage-rig/stage-rig.js`。
- rig 拥有铰链旋转：`.hf-rig-wall-inner-left/right`（±86°）、`.hf-rig-wall-outer-left/right`（∓172°）、
  `.hf-rig-floor`（-90°→0°）、`[data-hf-prop-foot]`（88°→0°）。
- scene wrapper 拥有其他变换：`#rig` 只做后退 `y/scale`；纸盒、托盘、光池只做位移与缩放。
- 展开顺序：内板先开 → 外板随后 → 地面落下 → 道具立起，逐级锁定在 0°。

使用 `rig.rebuild` 积木时，重建区间内铰链角度与包装层位移都由该积木写，工程不得再对 `rig.root` 或 `wrapper` 写 `transform`。

## 4. Plan（详细）

| 段 | 时间 | actor 主体 | object 对象 | audience view 观众看到 | hinge owner 铰链归属 | reading window 阅读窗口 | transition cause 转场原因 | cue | audio |
|---|---|---|---|---|---|---|---|---|---|
| S0 开场 | 0.00–1.30 | 台口边条、幕布、标题卡 | 舞台外壳 | 台口滑入，标题卡出现，幕布从中线拉开 | 无（幕布/台口是场景层位移） | 0.30–1.00 标题卡 | 开演 | 0.05 台口 / 0.12 标题卡 / 0.80 开幕 / 0.95 标题卡让位 | 无 |
| S1 搭景 | 1.30–2.20 | 折叠装置 | 四块墙板 + 地面桥 + 立牌道具 | 内板先开、外板随后、地面落下、道具立起；六个纸盒交错落到台面 | rig | 1.95 起「① 观察」 | 开演搭台 | 1.30 内板 / 1.35 地面 / 1.45 外板 / 1.70 道具 / 1.55 起物件交错 | 无 |
| S2 观察 | 2.30–6.00 | 焦点光 + 六个纸盒 | 一排六个纸盒 | 光从左侧扫到右侧，逐个纸盒轻抬 | 无（第 3 层强调） | 保持「① 观察」稳定 | 逐件查看 | 2.30 光起 / 3.35+i·0.30 逐件点名 / 5.20 光收 | 无 |
| S3 分组 | 6.15–11.00 | 托盘 + 六个纸盒 + 指示线 | 两簇：暖色 3 / 冷色 3 | 托盘进入，光分成两池，纸盒沿指示线移到同色托盘 | 无 | 6.60–11.20「② 分组」 | 按颜色找共同点 | 6.15/6.25 托盘 / 6.40 光分池 / 6.70+i·0.42 移动 / 9.55 归位强调 | 无 |
| S4 重建 | 11.20–13.90 | 折叠装置 + 关键纸盒(amber) | 旧景与关键纸盒 | 道具塌 → 外板折 → 内板折 → 整台后退 → 新地点在视野里重新搭起；关键纸盒停在台上 | rig 折叠；`#rig` 只做后退位移/缩放 | 13.55–14.30「③ 解释」 | 换地点、保留共同点（动作完成转场） | 11.20 道具 / 11.45 外板 / 11.90 内板 / 12.45 后退 / 12.75–13.35 重搭 / 13.55 解释标签 | 无 |
| S5 收尾 | 14.30–16.00 | 三步标签 + 幕布 | 全台 | 三枚步骤标签进入并轻强调，幕布合拢 | 无 | 14.35–15.30 三步回顾 | 收束 | 14.35 标签 / 14.95 强调 / 15.40 闭幕 | 无 |

可读检查点：**2s** ① 观察 + 六个纸盒；**6s** ① 观察完成；**11s** ② 分组完成（暖色 3 / 冷色 3）；**15s** 三步回顾。

## 5. 精确资源

卡内资产用 `component install stage-full/<资产>` 装进 Work，精确版本与 SHA-256 由 Work 的 `COMPONENT_LOCK.json` 记录；同版本内容不同时拒绝覆盖。

## 6. 阶段分工（Script / Research / Plan / Draft / Export）

- **Script**：本卡不产出；示例无口播、无字幕、无逐字对齐。
- **Research**：本卡不产出；机制来自已授权的只读提取（§1）。
- **Plan**：§4 表即 Plan；引用机制并声明铰链归属与阅读窗口。
- **Draft**：卡内 `assets/` 的 `stage-rig`、`stage-kit`、`stage-motion` 是 Draft 的构件，按 §10 接入工程。
- **Export**：由工作流与宿主渲染；本卡不持有成片、不导出、不做成片验收。

## 7. 技术检查

- **确定性 seek**：唯一 paused 主时间线注册到 `window.__timelines["<composition-id>"]`，同一条交给
  `HarnessScene.bindScene`；外部 seek 到 t 时直接重建完整状态，`dispose()` 解绑并 kill 时间线。
  无 RAF / play / autoplay / Date / Math.random，不依赖 seek 事件或回调。正放、倒放、随机 seek、重复 seek 一致。
- **字体**：`document.fonts.ready` 就绪后才首次渲染；`@font-face` 只指向 `media/SourceHanSansCN-Regular.otf`，
  `font-display:block`；不使用网络字体或系统回退排版。
- **布局**：固定 1920×1080；五层各占一层，第 3 层不遮挡第 4 层正文；文字只在阅读窗口内保持稳定。
- **闭包**：工程只依赖宿主放好的 `runtime/gsap.min.js`、`runtime/scene-binding.js`、`runtime/stage-rig.js`
  与 `media/SourceHanSansCN-Regular.otf`；无图片、音频、字体下载与新依赖；所有道具与布景为原创内联 SVG/CSS 剪贴。

## 8. 声音与封面

示范编排静音，便于对照动作。

- **音效**：**只**为结构重击与关键 hit 配音效（如 S4 折叠的落定、S3 归位的轻点），**不要**给普通入场自动配音效。
  来源是 earshot 音效库渲染（`work component generate-sfx --engine earshot`，可按动作调时长与峰值时刻）、
  SuperCollider / jsfxr 配方，或 HyperFrames 自带音效导入。
- **BGM**：配置开启 `bgm.enabled` 时可铺一条 BGM，按 `bgm.policy` 的曲库与情绪偏好，从开源曲库选现成曲目，
  用 `work component import-bgm` 带许可导入；**不用**音乐模型或代码合成 BGM。整片一条、不随 Scene 换曲，口播区间自动避让。
  未开启时 sound 块不写 bgm。
- 所有 cue 必须对应同帧可见事件，并按 `data-start` 调度以保证 seek 安全。
- **封面**：本卡不规定封面，按工具的封面合同（`.studio/spec/creative.md`）用 `work cover render` 合成，不为单个 Work 生图。

## 9. 六种做坏方式（开工前、交付前各对一遍）

| 做坏方式 | 改法 |
|---|---|
| **翻页式 PPT**：第 4 层反复换同位置、同样式的文字卡，第 2 层只换贴图；镜头和台面没有动作。 | 每镜安排具体物的动作，用 rig、托盘或道具完成变化；A/B 按观看任务交接，第 4 层仍守阅读保护，首尾落在物上。 |
| **照搬示范**：把示例或别的 Work 的台口、幕布、吊灯搬来，当作全片常驻页框。 | 只借折叠与交接机制，按题材重写台面与道具；幕布用于开场收尾，换地点由 rig 折叠重建。 |
| **没有具体的物**：概念只有字卡和灰矩形，第 2 层没有可辨认的主体。 | 镜头表逐行写出物与动作；用纸艺道具承载关系，独立解释放第 4 层，附着短标注留第 2 层。 |
| **死背景 / 空画面**：常驻位图始终不动，或主物隐藏、离屏，只剩文字。 | 布景随叙事变化，每个 Scene 检查三帧主物与 rig 的实际可见性；第 2、3 层响应守住节奏，不靠第 1 层漂移充数。 |
| **有真实素材却用代码画**：已有截图、照片或录像，仍造一个缺少证据细节的替身。 | 真实素材按 B-roll 放入第 2 层纸框，保留来源与证据细节；代码负责纸框、附着标注和动作，B 的独立解释仍放第 4 层。 |
| **画风拼贴 + 贴图方块**：写实位图、纸艺、Q 版与毛玻璃同框；带背景的方图直接上台。 | 表前锁本卡纸艺画风、色板与角色状态；道具用带 alpha 的镂空图，方图只进纸框或作墙面贴纸，写实件避开阅读区上方。 |

## 10. 积木清单

标准动作（前景：出现、退场、强调、移动到、落定、换场，加本卡独有的归位；背景：全屏纸板展开、换景、收起，进阶为圆盘 + 纸板 + 小素材）见 [MOTION.md](MOTION.md)。前景物体的出现、退场、移动等一律用动作清单里的动作，不手写缓动；积木只负责它自己那件物的机关。

### 动作与背景接入 Work

- 工具动作 `runtime/motion.js` 随 Work 创建自动放进工程，不用安装。
- 卡内资产按用到的装：`work --work <id> --variant <id> component install stage-full/<资产> --binding-file <binding.json>`，背景用 `stage-rig`，积木用 `stage-kit`，前景动作用 `stage-motion`。文件落在 `vendor/components/stage-full/<资产>/v1/`，页面必须真的加载入口文件，否则 `component verify` 报错。
- 加载顺序：`runtime/gsap.min.js` → `runtime/scene-binding.js` → `runtime/motion.js` → `vendor/components/stage-full/stage-rig/v1/stage-rig.js` → `vendor/components/stage-full/stage-kit/v1/stage-kit.js` 与所用 `blocks/*.js` → `vendor/components/stage-full/stage-motion/v1/stage-motion.js` → 工程脚本。
- 渲染：`renderAt(t)` 里依次调用背景 `apply(t)`、积木 `apply(t)`、`motion.apply(t)`，都传全片秒数。

积木是可选工具，不是菜单：物由本期内容决定，积木只省掉定位、显隐、皮肤与确定性插值的工程活。积木由 `assets/stage-kit/stage-kit.js` 统一注册与组合，先加载核心，再加载所用积木；参数合同以各 `blocks/*.md` 为准。工程统一传入全片秒数，调用 `apply(t)` 重建画面，结束时调用 `dispose()`。

| 积木名 | 层 | 一句话 | 文档路径 |
|---|---|---|---|
| `disc.scene` | 第 1 层 background | 刚性圆盘半周换景，按件类型逐件装配布景。 | [assets/stage-kit/blocks/disc-scene.md](assets/stage-kit/blocks/disc-scene.md) |
| `rig.rebuild` | 第 2 层 stage | 依次折叠、后退、换皮肤并重新展开纸舞台。 | [assets/stage-kit/blocks/rig-rebuild.md](assets/stage-kit/blocks/rig-rebuild.md) |
| `prop.stand` | 第 2 层 stage | 镂空道具沿顶部铰链立起，带纸边与偏移投影。 | [assets/stage-kit/blocks/prop-stand.md](assets/stage-kit/blocks/prop-stand.md) |
| `prop.states` | 第 2 层 stage | 本期专属的多部件道具：命名状态、按时刻切换，物长什么样由工程决定。 | [assets/stage-kit/blocks/prop-states.md](assets/stage-kit/blocks/prop-states.md) |
| `inset.broll` | 第 2 层 stage | 纸框滑入局部镜头，支持缩放、平移与附着短标注。 | [assets/stage-kit/blocks/inset-broll.md](assets/stage-kit/blocks/inset-broll.md) |
| `stack.explode` | 第 2 层 stage | 纸质薄板沿 Z 轴拉开、聚焦并收拢。 | [assets/stage-kit/blocks/stack-explode.md](assets/stage-kit/blocks/stack-explode.md) |
| `slot.text` | 第 4 层 text | 固定阅读槽位补位，并在 B 接管时冻结和虚化。 | [assets/stage-kit/blocks/slot-text.md](assets/stage-kit/blocks/slot-text.md) |
| `spot.sweep` | 第 3 层 overlay | 焦点光沿关键帧扫过，可逐件脉冲点名。 | [assets/stage-kit/blocks/spot-sweep.md](assets/stage-kit/blocks/spot-sweep.md) |
| `spot.split` | 第 3 层 overlay | 一束焦点光分成两池。 | [assets/stage-kit/blocks/spot-split.md](assets/stage-kit/blocks/spot-split.md) |
| `tray.sort` | 第 2 层 stage | 托盘入场，物件沿因果指示线归位并轻点强调。 | [assets/stage-kit/blocks/tray-sort.md](assets/stage-kit/blocks/tray-sort.md) |
| `sign.plate` | 第 2 层 stage | 纸牌沿铰链立起，字逐个写在牌子上。 | [assets/stage-kit/blocks/sign-plate.md](assets/stage-kit/blocks/sign-plate.md) |

`inset.broll` 的 video 模式由积木自己写 `currentTime`，只用于本地预览；正式工程里的视频 B-roll 应走宿主的 `class="clip"` + `data-start` 时序。

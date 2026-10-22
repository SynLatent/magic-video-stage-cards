# HyperFrames 实现与 QA

## 实现

- 生产会话在授权 Work-local 或已登记 AssetSource 编写视觉内容；生产与开发会话均可编写组件，开发计划使用隔离夹具，工具与依赖装配在 WSL 开发环境完成。安装包、已接纳包、vendor 与 Accepted Snapshot 不原地改，必要变化派生新源 / 版本。
- Scene 组合模块与本地媒体，实际能力以已安装合同为准。Scene 只安排所需 Beat，允许计算布局和内聚空间舞台，不强制双画幅或透明根层。
- 采用 Plan 已确定的视觉主题参数。
- 阶段与接受边界只见 `.studio/workflow.md`。
- 日常制作与 QA 默认由 Work CLI 启动锁定官方 Studio；当前工程可编辑，登记版本只打开文件只读的独立审阅副本，不支持 Studio 保存，不暴露冻结快照、vendor 或外部资产。重开时校验副本，变化则新建目录并保留旧副本；诊断仍严格核验内容哈希。实际项目 URL 和定位端口来自启动结果，不硬编码或猜测。
- 宿主 Timeline 必须同步、确定性构建，使用 `{ paused: true }` 并注册到 `window.__timelines`；模块将动作写入该 timeline，不另行注册全局播放权。异步媒体 / 几何准备须完成后再同步建 timeline，ready 前不首次 seek。
- 动作不依赖 `Math.random()`、`Date.now()`、实时 delta、异步 Timeline、`repeat: -1` 或多个 Timeline 同时修改同一属性；可用固定 seed 初始化数据，再按时间直接求值。
- composition 或 Scene 保留 `S01` 等稳定 ID；结构性偏离返回 Animation Plan。
- `talking_head` 仅在人为主叙述的适用 Scene 保留人物布局；A-roll 为真人出镜，B-roll 为展示内容、图片等辅助素材，均在第 2 层，B 接管时保护人脸区；A/B 编排见 `visual-design.md`，主声源贯穿切换且只播放一次，其他视频音轨按需要明确静音。
- 按 Plan 选材和 `visual-design.md` 实现 seek-safe 的语义累积、强调、返回与叠层状态；直接 seek 与顺序播放结果相同，不只在播放回调中新建文字。Research 不规定动画机制。

## 混合时间与资源

当前候选通过 `project-config.json` 的 `snapshot_dependencies` 列表显式声明动态依赖；存在该键时按入口静态 src/import/fetch 字面量与声明文件收集闭包，未支持的 srcset/imagesrcset 明确报错，不漏拷后冒充闭合。准确源、副本与接受关系仍冻结，不对可变源使用硬链接。

- 先核对本地 HyperFrames / GSAP / Three.js 版本与适配器，优先复用已有 `hf-seek` / `window.__hfThreeTime` 接口；上游存在不代表当前安装可用。
- 使用 GSAP 的工程和组件须在本地 GSAP 后显式加载同版本的 `MotionPathPlugin.min.js`，两者随资产进入快照闭包。锁定 Studio 0.8.150 在使用 `motionPath` 且插件缺失时会尝试 CDN；本项目仍统一携带本地插件，不依赖联网 fallback。无 GSAP 的静态样段不因此增加依赖。
- DOM / GSAP 与 WebGL 共用全局时间，明确 Scene 偏移和局部重定时；同帧先求值属性、镜头与 shader，再绘制。成片动作不能以独立 RAF 或 `setAnimationLoop()` 为时间权威。
- 渲染关键状态不能仅放在 `onUpdate` / `onComplete` 回调；随机 seek 可能抑制回调。Flip、拆字与布局状态在字体/资源就绪后固定，不在播放回调中才补正文。
- 优先复用返回有限 Timeline 的小函数或既有效果注册接口，不另建引擎。效果只暴露实际需要的配置，由宿主控制尺寸、主题、资源、seed 与时间；文字默认 DOM / SVG，效果不拥有全局叙事。
- Three.js 与 addons 固定同版本，画布尺寸、像素比与色彩配置由工程控制。纹理、shader、模型、效果代码及其他实际依赖进入现有快照闭包，抓帧不临时联网；提供就绪与释放行为，不释放他人共享资源。
- 不引入依赖历史帧的物理模拟、反馈 shader 或累积拖尾，除非可重建任意时刻或已烘焙。Three.js 故障只阻塞相关 Scene，不静默以静态图冒充通过；主视觉替代沿用局部确认边界。

唯一动态参考及包含混合效果的 Draft 应实际播放、暂停、拖动、倒跳、再播放，并按 `[t3, 0, t1, t3]` 抓帧比较同一时刻。检查实际 Scene 范围、DOM/WebGL 同帧、阅读、就绪与释放；单 Scene 不证明全片正确。完整 planned-placeholder Draft 可缺已登记素材，但所有 Scene 及实际承诺动作必须存在。最终 Draft/Final 必需资源和效果闭合。Mock/静态检查不算 Windows 原生渲染通过，技术夹具不算生产复用。

需要混合求值时，可将 `.studio/runtime/scene-binding.js` 复制到 Work 的 `project/runtime/`，由 `HarnessScene.bindScene({start, duration, timeline, ready, renderAt, dispose})` 接到当前 HyperFrames 的 `hf-seek` / `waitUntil`。`start` 相对当前 composition 文档；绑定器拥有未单独注册的局部 paused Timeline，先求值再调用 `renderAt(localTime)`，宿主仍负责可见性。不要再将同一 Timeline 加入主时间轴或注册两次。`ready` 等待资产，不异步拼装 Timeline；释放时只清理绑定器自身资源。普通 GSAP 场景不需要此接线。

历史 `tests/visual-mixed.mjs` / `tests/visual-plan.mjs` 含视频编码路径，不能直接用作 v3.3 无导出验收。测试仅使用 Studio/浏览器动态证据或明确隔离的无编码入口；test-work、Draft 和局部声画检查均不以视频导出兜底。

## 音频与裁取

### 五层与运行时

模式为 `explainer`、`showcase` 与 `english`，默认 `explainer`（旧 `math` 锁只读，数学卡已退役）；使用 16:9 / 9:16。`--captions on|off` 在 `appearance_lock.selection.captions` 冻结布尔开关。showcase 的子模块与创作豁免见 showcase.md（仅自用包），五层仅为可选参考；各链路共用现有渲染器。

各链路按专属规则使用共同五层宿主，叙事职责见 `visual-design.md`：

| 层 | `data-hf-layer` | 责任与宿主 |
|---|---|---|
| 1 | `background` | 根常驻背景，只呈现世界/情绪 |
| 2 | `stage` | Scene 主体、角色、图片、图解及附着标签 |
| 3 | `overlay` | Scene 强调与转场，不独立承载信息，不遮挡阅读 |
| 4 | `text` | Scene 独立文字，主题样式与阅读保护 |
| 5 | `captions` | 根唯一口播字幕宿主，最高层安全区；关闭时不生成 |

根 composition 显式标注宿主，Scene 内第 2/3/4 层是同一 sub-composition 的三个显式容器。CSS `z-index` 决定叠放顺序，Studio 轨道号只决定显示，不代替 CSS；声音另占 audio 轨。

运行时用法按需读 [runtime-interfaces.md](runtime-interfaces.md)，资产接线按需读 [hyperframes-assets.md](hyperframes-assets.md)。只使用已安装合同；按接口卡取用，不读取组件与助手源码，派生时才读源码。

## Draft QA

showcase 不要求 explainer 分层/角色检查、Q1 或节奏诊断必经闭环；下文表现形式要求不适用，但 CDN、闭包外资产及 `onUpdate` 状态等硬约束继续检查。英语按教学 Plan 核对发音、拼写、词义、记忆提示、回忆任务及声画对应，保留合理阅读停顿，不强加通用角色、生图或 A/B 配额。诊断和代码证据不代替用户观看。

explainer 的 `preview diagnose` 另报告 `explainer_layer_missing`、`captions_lock_mismatch` 与 `sound_asset_outside_closure`，闭包检查覆盖音轨和 character。口播 audio 显式标注 `data-audio-role="voice"` 才豁免声音资产检查，其余 audio 必须来自 media 闭包，不能把 BGM/SFX 标为 voice 绕过校验。角色 DOM 标注 `data-character-ref="<id@vN>"` 辅助静态 diagnose 核对 character 闭包。均为静态疑点；第 5 层口播字幕不按第 4 层 A1 判为照搬。Plan/Q1 还需人工核验每场可见事件、角色与图片风格、遮挡和有声观看，技术报告不代替接受。

使用安装根内的锁定 Node、CLI 和浏览器。`npx --no-install` 仍按项目/npm 缓存解析包，不能保证选中安装根的版本；工程不需要另装 `node_modules`。Windows PowerShell 示例（替换安装根和工程路径）：

```powershell
$runtimeRoot = (Resolve-Path '<安装根>').Path
$project = (Resolve-Path '<工程目录>').Path
$env:NODE_OPTIONS = '--require ' + (ConvertTo-Json -Compress "$runtimeRoot\.studio\windows_node.cjs")
$env:HYPERFRAMES_BROWSER_PATH = "$runtimeRoot\runtime\chromium\chrome-headless-shell.exe"
$env:HYPERFRAMES_FFMPEG_PATH = "$runtimeRoot\runtime\ffmpeg\bin\ffmpeg.exe"
$env:HYPERFRAMES_FFPROBE_PATH = "$runtimeRoot\runtime\ffmpeg\bin\ffprobe.exe"
$env:HYPERFRAMES_NO_TELEMETRY = '1'
& "$runtimeRoot\runtime\node\node.exe" "$runtimeRoot\runtime\npm\node_modules\hyperframes\bin\hyperframes.mjs" check $project --json
```

修复错误、空 Scene、越界、遮挡、不可读和严重节奏问题。对照 Plan 检查问题 Scene 的稳定状态及核心变化：连接有指向，条件分支可区分，反馈在状态中可见，选稿与必需 Slots 不丢失。只看开头或 contact sheet、仅有字段 / CSS 差异不算语义通过；同 easing 或相似外观不自动失败。普通 Warning 不阻止 Draft。Plan 登记的 planned placeholders 允许全片预览，准确标出缺口；占位不是代码错误的豁免，也不具备最终交付资格。只有 full 范围且必需素材齐备的版本能获得完整接受并进入 Final；单 Scene 方向批准不能代替。

表达与观看检查按所选链路合同及 `visual-design.md` 的适用项：对照来源与实际可见文字核验上屏提炼和必要信息完整性，并在准确 Studio Draft 中连续观看，核验按层节奏事件、可读性和声画含义。确认缺陷阻止该版本作出相应 QA 通过和接受就绪声明，但不阻止保存、打开与继续修复 Draft；沿用原有方向确认、准确 Draft 接受及无导出边界。技术检查、设计兑现与用户接受分别保留。Windows Studio 实际声音、连续播放、暂停、seek/回拖缺证据时记未验证；播放受限交工具缺口，不导出带声短段或整片 Draft。

辅助诊断使用 `work --work <id> --variant <id> preview diagnose <target>`，`target` 为 `current` 或准确的 executable Plan/Draft 登记 ID（`plan-vNNN` / `draft-vNNN`）；静态 `reference` 和 `layout` 类型不支持。先用既有 `preview open <target>` 打开同一目标，参数见诊断命令 `--help`。登记 Plan/Draft 使用同版冻结的 Script、Research、Plan 和工程，当前文稿的跨版本差异单列；诊断中输入变化标过期。`scope: scene` 的 Plan 参考按登记的 `sample_scenes` 投影和采样，D1 只核对这些 Scene 映射的信息单元；其他 Scene 在 `d1.out_of_scope` 中以 `outside_reference_scope` 标明“不在本参考范围”，不报缺失或未验证。可见文字归属信息单元依次按元素最近的 `data-info-id`、与该 Scene 唯一信息块全文或某行完全相同、为唯一信息块的子串判定；多块同时匹配或无匹配保持未归属，按元素单列待人工核验，不合并做照搬比对，该 Scene 未观测的信息标 `plan_information_mapping_unresolved` 而非缺失。`data-info-id` 可选，多信息 Scene 推荐在信息块容器上标注。第 4 层上屏文字照搬定位（D1）与按层节奏定位只输出疑点、版本/Scene/文字或时间范围及未验证项。文本相似度、timeline 空档和画面采样只定位候选问题，范围内未覆盖部分标未验证；不报告工具 PASS，不以 tween 数量或像素变化代替观看判断。诊断只读 Work，不写 Plan、接受状态或 Final，不导出或编码视频；`--frames` 只写 Variant 运行目录下的自看帧。制作中自看可加 `--range START END` 或 `--times a,b,c` 只采样正在做的段：只投影与该段重叠的 Scene，D1 与节奏、舞台线索只覆盖这些 Scene，报告 `scope` 并标 `range_limited_sampling`；`--frames` 把每个采样存为 PNG 到 Variant `.runtime/diagnose-frames/`（只保留最近 3 次），配合 `--times` 时逐点经片首、片尾重 seek 比对像素，报告 `determinism`。报告的 `sampling` 给出已验证采样数，为 0 时附重开预览的提示。这些帧只供执行者自看，不作交付或审片证据；交付 Draft 前仍对准确版本做不带范围的全片诊断。

D1 读取 Plan 逐 Scene 内的 `screen` 信息块，使用其稳定信息 ID。就绪样本已覆盖的 Scene 中，未出现的信息报 `plan_information_missing`，真子集或明显缩短的表达报 `plan_information_truncated`，其他差异报 `plan_implementation_difference`；诊断范围内未覆盖 Scene 仍为未验证。截短是相对 Plan 的疑点，不是按字数判断内容质量，仍需人工核验语义和阅读效果。

需节奏闭环的链路按其规则处理诊断；英语的合理阅读与回忆停顿不要求填满运动。节奏定位自动提取宿主 GSAP 时间线与助手的第 2–4 层候选，须有可见变化；氛围标 `data-hf-ambient` 排除。报告超过 2 秒的空档与“铺开再等”；背景、字幕、待机/说话起伏、持续镜头运动中间过程不计。Canvas/WebGL/视频不能核对处标未验证。声明事件须匹配目标及 cue 区间，不能由其他目标代替。交付前逐项修正、写获批例外或说明原因，附报告路径与未处理项。只读摘要，`--json` 输出完整结构，不读取 `probe.json`；诊断不判通过。事件合同见 `visual-design.md`。

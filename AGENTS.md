# AGENTS.md

本包是两张纸艺舞台视频设计卡（`stage-full`、`stage-light`）及其运行时。人类读者的总览见 [README.md](README.md)。

## 先读什么

| 任务 | 读 |
|---|---|
| 用卡片做一支视频 | `designs/stage-full/GUIDE.md` §0、§9 → `MOTION.md` → `stages/plan.md` → `stages/draft.md` |
| 用到某个积木 | 对应的 `designs/stage-full/assets/stage-kit/blocks/<积木>.md`，参数以它为准 |
| 用 stage-light | `designs/stage-light/GUIDE.md` 与 `MOTION.md`；资产与动作都来自 stage-full |
| 修改卡片本身 | 上面全部，加各卡 `CHANGELOG.md` |

`spec/` 是 Magic Video 通用规范的只读副本；与卡内文档冲突时以卡内文档为准。

## 硬规则

1. **确定性**：一条 paused 主时间线；画面状态是全片秒数 `t` 的纯函数，统一在 `renderAt(t)` 里调用背景、积木与动作的 `apply(t)`。不用 `requestAnimationFrame`、定时器、`Date`、`Math.random`（需要随机用固定种子），不依赖 seek 事件回调；正放、倒放、重复 seek 结果一致。
2. **动作只用动词**：前景物体的出现、退场、强调、移动、落定、换场、归位只用 `MOTION.md` 里的动作名，不手写缓动或关键帧。动作拥有目标的 `transform`、`opacity`、`visibility`，工程不再写这三项；同一物体同一通道同一时段只能有一个动作，重叠会在添加时抛错。`appear`、`sortTo` 已含落稳，不再接 `settle`。
3. **背景顺序**：默认背景用 `HarnessStageRig.createBackdrop`，动作顺序必须是 `unfold` → `refold`… → `fold`，互不重叠。前景在换景开始前退场、换景完成后再出现。用了 `disc.scene` 进阶背景就不再另放 `createBackdrop`。
4. **分层**：第 1 层 background、第 2 层 stage、第 3 层 overlay、第 4 层 text。布景件带 `data-hf-set`；全屏层宿主写 `pointer-events: none`，直接子节点恢复 `auto`。第 3 层不遮挡第 4 层正文。
5. **内容**：每镜写具体的物和它的动作，不用文字卡或灰矩形代替主体；主物约占台面区 40% 以上；屏上字每镜 8 字以内；第一镜和最后一镜落在物上。示范编排里的秒数是可读检查点，不是口播对齐。
6. **资源闭包**：不加网络字体、CDN 或新依赖。所有可能含中文的文字 `font-family` 最后落到 SourceHanSansCN，否则显示方框。
7. **积木是工具不是菜单**：积木只省掉定位、显隐、皮肤与插值的工程活；本期专属的物用 `prop.states` 描述或手写，不为了用积木把物换成纸框、牌子或光。

## 自检

- 类名覆盖：`node designs/stage-full/tools/check-classes.mjs <工程目录> --rig designs/stage-full/assets/stage-rig/stage-rig.js`，退出码非 0 先修。
- 取帧与重 seek 比对：`node designs/stage-full/tools/sample-frames.mjs <小样目录> <输出目录> --times 0,2.5,7 --browser <chrome> --puppeteer <puppeteer-core 目录>`；小样要有 `index.html` 和注册到 `window.__timelines` 的 paused 主时间线。
- 能看图时自己看帧修正，每段最多 3 轮「改 → 取帧 → 看」；看不了图时把帧交给能看图的一方，不自行判断构图成立。

`work …`、`preview diagnose`、`critic round` 等命令只存在于 Magic Video 工具链；不在该环境时跳过，改用上面两个脚本。

## 修改卡片

- 对使用者可见的变更递增该卡 `design.json` 的 `version`，并在该卡 `CHANGELOG.md` 记一行。
- 积木参数合同改动同步更新对应 `blocks/*.md`；`stage-light` 引用 `stage-full/stage-rig` 与 `stage-full/stage-motion`，改这两个资产要同时检查 stage-light。
- 不在卡内写具体作品、运行环境、模型或账号约定；个人定制另建卡片。

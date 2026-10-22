# stage-light · Draft 阶段指南

## 机制与实现

- 构件：所引用的 `stage-full/stage-rig` 资产；全部为原创内联 SVG/CSS 剪贴，带白边与偏移投影。
- 折叠与交接：`HarnessStageRig.createPaperStage({panels:2})` 只建内板一对；无台口/吊灯/`spot`，强调只用第 3 层 `#readbar` 读行；关键薄荷纸卡靠空间位移完成 ② → ③ 的语义交接。
- 单一 paused 主时间线注册到 `window.__timelines['<composition-id>']`，同一条交给 `HarnessScene.bindScene`；无 RAF / play / autoplay / Date / Math.random。
- 动作：物体的出现、退场、强调、移动、落定、换场与归位只用 [MOTION.md](../MOTION.md) 里的动作（`HarnessMotion.create({ card: 'stage-full' })`）；换地点用背景动作 `refold`，前景在换景开始前退场、换景完成后再出现。
- 外部 seek：seek 到 t 时直接重建完整状态，`dispose()` 解绑并 kill 时间线；不依赖 seek 事件或回调。

## 资源闭包、字体与释放

- 资源闭包：工程只依赖宿主放好的 `runtime/gsap.min.js`、`runtime/scene-binding.js`、`runtime/stage-rig.js` 与 `media/SourceHanSansCN-Regular.otf`；无图片、音频、字体下载与新依赖。Work 工程另有 `runtime/motion.js` 与 `vendor/components/stage-full/` 下装好的 `stage-rig`、`stage-motion`（见 MOTION.md「接入 Work」）。
- 字体：`document.fonts.ready` 就绪后才首次渲染；`@font-face` 只指向 `media/SourceHanSansCN-Regular.otf`，`font-display:block`。
- 布局：固定 1920×1080；第 3 层读行不遮挡第 4 层文字；文字只在阅读窗口内稳定。

## 具体技术检查

- 确定性 seek：正放、倒放、随机 seek、重复 seek 一致；对 `[t3, 0, t1, t3]` 抓帧比较同一时刻。
- 释放：`dispose()` 解绑并 kill 时间线后不再响应 seek。
- 声音：示例静音；若某 Variant 需要音效，只为结构重击与关键 hit（如 S4 折叠落定）配音效，不给普通入场自动配音效；BGM 只在开启 `bgm.enabled` 时用一条开源曲库导入的现成曲目，不合成 BGM；所有 cue 对应同帧可见事件并按 `data-start` 调度以保证 seek 安全。
- 不新增几何/函数预置、通用角色库、AI 概念图库或 BGM 生成。

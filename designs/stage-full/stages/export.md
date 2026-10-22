# stage-full · Export 阶段指南

- 走标准导出链，从准确 Accepted Draft 的闭合快照导出；由工作流与宿主渲染，只导出生产 Finalize，Draft/test-work 不导出视频。
- 本卡不持有成片；正式交付以实际采用输入为准，示例动画秒数是作者编排，不是原生字词时间或听校证据。
- 声音与字幕证据：本卡 `captions.enabled=true` 默认开启；导出以实际采用音频与字幕证据为准，未提供实际音频/字幕证据前不得声称已验证。
- 工程本地资产：`runtime/gsap.min.js`、`runtime/scene-binding.js`、`runtime/motion.js`、所装卡内资产的 `vendor/components/stage-full/<资产>/v1/` 与 `media/SourceHanSansCN-Regular.otf`；导出前跑 `component verify`，确认闭包完整、无联网回退。
- 未在锁定的 Studio 中连续播放、未实际听音前，声音、字幕与真实画面标未验证，不声称已通过。
- 逐项修正诊断、写获批例外或说明原因，附报告路径与未处理项。

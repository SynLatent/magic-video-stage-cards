# stage-light · 动作清单

本卡直接复用 stage-full 的动作包，动作名、参数、规则和观感与 stage-full 完全相同，完整表格见 [stage-full 动作清单](../stage-full/MOTION.md)。只用那张表里的动作名，不手写缓动或关键帧。

```js
var motion = HarnessMotion.create({ card: 'stage-full' });   // 本卡没有自己的动作包，用 stage-full 的
var backdrop = HarnessStageRig.createBackdrop({ mount: backgroundLayer, panels: 2, horizon: 700,
  skins: { warm: { wall: ['#f7ecd8', '#e6cfa8'], floor: ['#dcbd8e', '#c49a63'] },
           cool: { wall: ['#e4eff7', '#b4cde0'], floor: ['#b9d3e6', '#8fb2cd'] } } });
backdrop.unfold({ at: 0.2 });
motion.appear([card1, card2, card3], { at: 2.4, stagger: { span: 0.3 } });
motion.sortTo(card2, { at: 6.6, to: { x: -320, y: 40 } });
backdrop.refold({ at: 11.2, skin: 'cool' });
backdrop.fold({ at: 15.0 });
function renderAt(t) { backdrop.apply(t); motion.apply(t); }   // 交给 HarnessScene.bindScene
```

## 与 stage-full 的差别

| 项 | stage-light 的做法 |
|---|---|
| 前景动作 | 七个动作（出现、退场、强调、移动到、落定、换场、归位）全部照用，`card` 写 `'stage-full'` |
| 默认背景 | 同一个全屏纸板背景动作，`panels: 2`（两块背板），展开 / 换景 / 收起不变 |
| 进阶背景 | 不用。圆盘 + 纸板 + 小素材属于 stage-full，本卡要这种背景就改选 stage-full |
| 强调 | 光与舞台机械不用；需要指向时用第 3 层读行，物体本身的强调用 `emphasize` |

## 接入 Work

- `runtime/motion.js` 随 Work 创建自动放进工程，不用安装。
- 背景和前景动作都装 stage-full 的资产：`work --work <id> --variant <id> component install stage-full/stage-rig --binding-file <binding.json>`，`stage-motion` 同理。文件落在 `vendor/components/stage-full/<资产>/v1/`，页面必须真的加载入口文件，否则 `component verify` 报错。
- 加载顺序：`runtime/gsap.min.js` → `runtime/scene-binding.js` → `runtime/motion.js` → `vendor/components/stage-full/stage-rig/v1/stage-rig.js` → `vendor/components/stage-full/stage-motion/v1/stage-motion.js` → 工程脚本。
- 渲染：`renderAt(t)` 里先调背景 `apply(t)`，再调 `motion.apply(t)`，都传全片秒数。

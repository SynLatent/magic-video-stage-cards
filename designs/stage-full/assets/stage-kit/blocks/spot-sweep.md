# spot.sweep

第 3 层径向暖光沿关键帧扫过物件，用点名脉冲强调焦点，不承载信息。

## options

| 字段 | 必填 / 默认 | 含义 |
| --- | --- | --- |
| mount | 必填 | 位于 `data-hf-layer="overlay"` 宿主内的元素 |
| size | 必填 | 正数，光的直径，px |
| keys | 必填 | 至少两项 `{ at, x, y, scale?, opacity? }`；at 秒，严格递增；x/y 为宿主坐标中的光心，px |
| keys[].scale | 1 | 正数缩放 |
| keys[].opacity | 0.9 | 0 到 1 |
| fadeIn | `{ dur: 0.5 }` | 首帧前的淡入时长，dur 为正数秒 |
| pulses | `[]` | `{ at, dur?, scale? }` 数组；dur 默认 0.24 秒，scale 默认 1.07，均为正数 |
| out | 无 | `{ at, dur? }`；dur 默认 0.4 秒，正数 |

几何与时刻必须为有限数；缺少必填项、非递增关键帧、非法层宿主会抛出 TypeError。创建前复制参数，不修改输入。

## apply(t) 时间线

- `t <= keys[0].at - fadeIn.dur`：隐藏，位于首帧光心，scale 为 0.9。
- 首帧前的淡入区间：out3 将 opacity 从 0 推到首帧值，scale 从 0.9 推到首帧值。
- 两关键帧之间：sineInOut 同步插值 x/y/scale/opacity。
- 最后一帧之后：保持末态，直到 out。
- 每个 pulse 的前半按 inOut 从倍率 1 到指定 scale，后半回到 1；脉冲倍率叠乘到当前 scale。
- out 区间按 out3 将 scale 收至 0.92、opacity 降至 0；结束后保持隐藏。

每次调用完整重建 left、top、transform、opacity 和 visibility，支持重复、倒序及任意 seek。create 时自动 apply(0)；dispose 移除节点，可重复调用，之后 apply 无操作。

## DOM 与 CSS

唯一节点 `div.hf-kit-spot-sweep-light`，亦为返回的 root。由 kit.make / kit.abs 创建，带 `aria-hidden="true"`；无文字、无交互。left/top 为光心减 size/2，中心缩放。CSS 用 `hf-kit-spot-sweep` 注入一次，包含圆形暖光径向渐变、中心 transform-origin 和 pointer-events:none。显隐仅由 kit.shown 设置。

## 镜头表这一行

| 镜头 | 层 | 积木与参数 | 动作 |
| --- | --- | --- | --- |
| 观察物件 | 3 overlay | spot.sweep，size:1000，keys:[{at:2.8,x:560,y:880},{at:5.85,x:1360,y:880}]，pulses:[{at:3.35}]，out:{at:6.1} | 暖光从左扫右，点名后缩光退出 |

```js
var sweep = HarnessStageKit.create('spot.sweep', {
  mount: overlayLayer,
  size: 1000,
  keys: [{ at: 2.8, x: 560, y: 880 }, { at: 5.85, x: 1360, y: 880 }],
  pulses: [{ at: 3.35 }],
  out: { at: 6.1 }
});
// renderAt(t) 中调用 sweep.apply(t)。
```

先加载 stage-kit.js，再加载 blocks/spot-sweep.js。不遮挡第 4 层正文：光心不得落在阅读窗口内。这是镜头表作者的责任，积木不校验阅读窗口。

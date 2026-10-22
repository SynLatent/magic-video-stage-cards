# spot.split

将第 3 层的一束暖光分成两池，用来强调分组结果。

## options

| 字段 | 必填 / 默认 | 含义 |
| --- | --- | --- |
| `mount` | 必填 | 位于 `data-hf-layer="overlay"` 宿主内的元素 |
| `size` | 必填 | 两个光节点的直径，正数，px |
| `from` | 必填 | `{ x, y, scale? }`，初始光心坐标（相对 mount），px；scale 默认 1，须为正数 |
| `to` | 必填 | 恰两项 `{ x, y, scale? }`，分别为 A、B 的目标光心；scale 默认 1 |
| `at` | 必填 | 分光开始的全片秒数 |
| `dur` | 0.55 | 分光持续秒数，须为正数 |
| `opacity` | 0.82 | 两池的目标透明度，0–1 |
| `out` | 可选 | `{ at, dur }`，一起退场的全片秒数与正数时长；提供时两项均必填 |

几何和时刻经核心数值校验；缺少必填项、非有限数值、非法尺寸、时长、缩放、透明度或非两项目标均抛 `TypeError`。先加载核心，再加载 `blocks/spot-split.js`。

## apply(t) 时间线

- create 时调用 `apply(0)`。在 `at` 前，A 位于 `from`，使用 `from.scale` 和 `opacity`，即已可见；B 隐藏于 `from`。
- `at` 至 `at + dur`：按 `sineInOut` 将两池的 x、y、scale 从 `from` 插值到各自目标；A 保持透明度，B 按同一进度淡入。
- 分光结束后保持目标状态，未提供 `out` 时持续保持。
- `out.at` 至 `out.at + out.dur`：两池按 `sineInOut` 同时淡出，缩放乘数从 1 到 0.92；结束后均隐藏。分光与退场进度分别从 t 计算，若时间重叠则叠乘。
- 每次调用都重写两个光节点的位置、缩放、opacity 和 visibility；重复 seek、倒放和回到 0 不依赖上次状态。`dispose()` 移除自身 root，可重复调用。

A 在分光前不会自动隐藏。若需要先隐藏或扫光，由镜头表将 `at` 之前交给 `spot.sweep` 接管，并安排 `spot.split` 的创建或宿主交接，避免重复叠光。本积木只做第 3 层强调；镜头表作者应让光心避开第 4 层正文阅读窗口。

## DOM 与类名

- `div.hf-kit-spot-split-root`：mount 下的绝对定位容器，原点为 `(0, 0)`。
- 两个 `div.hf-kit-spot-split-light`：root 下按 A、B 顺序排列，共享同一 CSS 类与径向暖光渐变。宽高均为 size，left/top 为光心减 size/2，transform 为中心缩放。

全部节点由 `kit.make`、`kit.abs` 创建；显隐经 `kit.shown` 成对设置。样式通过 `kit.ensureCss('hf-kit-spot-split', ...)` 注入一次，不依赖 example 样式。

## 镜头表这一行

| 镜头 | 积木 | 参数 | 动作 |
| --- | --- | --- | --- |
| ② 分组 | `spot.split` | `size:1000, from:{x:1360,y:880,scale:0.92}, to:[{x:760,y:880,scale:0.62},{x:1210,y:880,scale:0.62}], at:6.3, dur:0.55, opacity:0.82, out:{at:11.15,dur:0.4}` | 主光移到左池，副光向右池移动并淡入，末尾共同缩小淡出 |

```js
var split = HarnessStageKit.create('spot.split', {
  mount: overlayLayer,
  size: 1000,
  from: { x: 1360, y: 880, scale: 0.92 },
  to: [{ x: 760, y: 880, scale: 0.62 }, { x: 1210, y: 880, scale: 0.62 }],
  at: 6.3,
  dur: 0.55,
  opacity: 0.82,
  out: { at: 11.15, dur: 0.4 }
});
// 由宿主全片时钟调用 split.apply(t)。
```

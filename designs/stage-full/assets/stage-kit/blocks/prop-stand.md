# prop.stand

将透明道具沿顶部铰链立起，带白色纸边和偏移投影，支持按全片时间任意跳转与反向折下。

## options

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| mount | Element | 是 | 第 2 层 `data-hf-layer="stage"` 内的元素，优先使用 `rig.parts.propsLayer` |
| box | {x,y,w,h} | 是 | 相对宿主的像素位置与尺寸；宽高须大于零 |
| media | Object | 是 | 道具媒体 |
| media.kind | 'img' 或 'svg' | 是 | 透明图片或 SVG |
| media.src | string | 条件 | 图片资源地址；SVG 无 markup 时使用该地址，工程应提供本地资源 |
| media.markup | string | 条件 | SVG 源码；存在时优先，以 SVG 图片数据地址呈现，不插入活动内联节点 |
| media.alpha | boolean | img 必填 | 图片必须显式声明 `true`，否则抛出 TypeError；调用方保证真实镂空 |
| at | number | 是 | 立起起点，单位秒 |
| dur | number | 否 | 到达冲击角的时长，默认 0.45 秒，须大于零 |
| out | number | 否 | 退场起点；省略则保持立起 |
| outDur | number | 有 out 时必填 | 折下时长，须大于零，无静默默认值；不可单独提供 |
| rim | number | 否 | 白色纸边宽度，默认 6 像素，须非负 |

几何与时间使用公共校验器读取。缺少必填项、错误宿主、非法媒体类型或非有限数值均抛出 TypeError。图片设置 `draggable=false`、`alt=''`，尺寸采用 contain。白边由 CSS 四向无模糊投影构成，最后叠加偏移阴影。

## apply(t) 时间线

- `t < at`：折叠到 88°，隐藏。
- `[at, at + dur)`：`kit.settle(t, at, dur, 0.16)` 的 out3 段，将 88° 转到 -1.5°。
- `[at + dur, at + dur + 0.16)`：同一 settle 的 backOut(2.2) 段，将 -1.5° 回到 0°。
- 此后：保持 0°。
- 提供 out 时，从 out 时刻的进场角度经 out3 反向折到 88°，在 `out + outDur` 隐藏。退场若打断进场，从该时刻角度连续折下。

创建时立即执行 `apply(0)`。每次调用都重建 foot 和图片的显隐以及 foot 的角度，不累计状态、不使用独立时钟。`dispose()` 移除根节点，可重复调用；销毁后的 apply 不再写 DOM。

## DOM 与角度归属

```text
mount
└─ div.hf-kit-prop-stand-foot [data-hf-kit-foot]（root）
   └─ img.hf-kit-prop-stand-media
```

上述两个类的全部规则均由 `hf-kit-prop-stand` 样式块注入；两个节点均通过 kit.make 创建、kit.abs 绝对定位、kit.shown 显隐。

foot 的 `transform-origin` 为 `50% 0`。铰链角由本积木写，rig.apply 不会覆盖：本积木使用 `data-hf-kit-foot`，不使用 rig 扫描的 `data-hf-prop-foot`。直接挂载到 propsLayer，不另建旋转父级；rig 的 prop 参数不控制本积木，折叠时需调度本积木 out。工程不得另外改写 foot 的 transform。

## 镜头表

| 镜头 | 舞台动作 | 参数与时间 |
| --- | --- | --- |
| 道具立起 | prop.stand | box={x:600,y:400,w:260,h:320}；透明媒体；at=1；dur=0.45；out=3；outDur=0.4 |

先加载 stage-kit 核心，再加载本积木，通过 `HarnessStageKit.create('prop.stand', options)` 创建，将返回值的 apply(t) 接入工程全片时间驱动。

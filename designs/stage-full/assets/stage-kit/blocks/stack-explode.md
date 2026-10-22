# stack.explode

把第 2 层的一组纸质薄板沿 Z 轴拉开、聚焦并收拢，用于结构拆解与叠层剖切。

先加载 `stage-kit.js`，再加载 `blocks/stack-explode.js`，通过 `HarnessStageKit.create('stack.explode', options)` 创建。

## options

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| mount | Element | 是 | `data-hf-layer="stage"` 宿主或其内部元素 |
| origin | {x, y} | 是 | 叠层底面中心，单位 px |
| layers | Array | 是 | 2–6 层，数组顺序自下而上 |
| layers[].id | string | 是 | 非空层标识，写入板的 `data-layer-id` |
| layers[].name | string | 是 | 非空层名称 |
| layers[].note | string | 否 | 标签补充说明；有值时显示为「name · note」 |
| layers[].w、h | number | 是 | 正数板宽、高，单位 px；各板均以 origin 为中心 |
| tilt | {x, z} | 是 | X、Z 旋转角度，单位度，例如 `{x:56,z:-42}` |
| gap | number | 是 | 完全拉开时相邻层的 Z 距离，非负，单位 px |
| explode | {at, dur} | 是 | 拉开起点与正数时长，单位秒 |
| focus | Array<{index, from, to}> | 否 | 聚焦区间，index 为从 0 开始的层索引，to > from |
| collapse | {at, dur} | 否 | 收拢起点与正数时长，单位秒；省略则保持拉开 |
| perspective | number | 否 | 正数透视距离，默认 1800 px |

几何和时间必须显式提供，使用核心校验函数读取；缺失或非法值抛出 `TypeError`。标签按纯文本写入，不解释 HTML。字体继承宿主。

## apply(t) 时间线

`t` 是全片秒数。创建时显式执行 `apply(0)`，每次调用都从时间重新计算，支持倒放、回跳和重复定位。

- `t < explode.at`：各板 Z 位移为 0，纸板和标签均可见。
- `explode.at` 至 `explode.at + explode.dur`：进度 `p` 按 `kit.ease.inOut3` 从 0 到 1，第 i 层位移为 `translateZ(i * gap * p)`。
- 拉开结束后：保持完整层间距。
- 若提供 collapse：收拢区间按同一缓动将拉开进度乘以 `1 - 收拢进度`，结束后全部回到 Z=0。
- focus 使用 `[from, to)` 区间；区间内对应层增强边框与金色发光、标签加粗，其余层通过纸面和文字颜色略微变暗。多个有效区间同时存在时，对应层均高亮；离开区间恢复普通样式。

所有板和标签每次均调用 `kit.shown(node, 1)`；变暗不用透明度，不以整体淡出代替 Z 位移动作。容器也显式设为可见。为获得「拉开 → 观察 → 收拢」的顺序，应把 collapse.at 放在拉开结束之后。

## DOM 与类名

所有节点由 `kit.make` 创建、由 `kit.abs` 绝对定位；以下类均在积木自己的 CSS 中声明：

```text
mount
└─ div.hf-kit-stack-explode-root（origin 中心定位）
   └─ div.hf-kit-stack-explode-stack（preserve-3d，透视与倾斜）
      └─ div.hf-kit-stack-explode-plate × 层数（纸面、白边、投影、Z 位移）
         └─ div.hf-kit-stack-explode-label（板下沿外的名称与说明）
```

stack 的变换为 `perspective(P) rotateX(tilt.x) rotateZ(tilt.z)`；板与标签全部 CSS 绘制，不创建图片，不依赖动画时钟或第三方库。`dispose()` 移除根节点，可重复调用；销毁后的 `apply(t)` 不再写 DOM。

## 镜头表写法

| 时间 | 画面内容 | 舞台动作 | 参数说明 |
| --- | --- | --- | --- |
| 1–7 秒 | 三层结构拉开，聚焦中层后收拢 | stack.explode | origin={x:620,y:420}；三层各 w=320,h=200；tilt={x:56,z:-42}；gap=90；explode={at:1,dur:1.2}；focus=[{index:1,from:3,to:5}]；collapse={at:6,dur:1} |

工程提供第 2 层 mount 和每层的 id、name、可选 note，在渲染入口调用 `block.apply(t)`。

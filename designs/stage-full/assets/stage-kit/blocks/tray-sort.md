# tray.sort

第 2 层托盘上浮入场，物件沿直线归入指定托盘，并可在第 3 层显示虚线指示。

## options

| 字段 | 必填 / 默认 | 含义 |
| --- | --- | --- |
| mount | 必填 | `data-hf-layer="stage"` 宿主内元素 |
| trays | 必填数组 | 托盘列表 |
| trays[].id | 必填 | 唯一非空字符串 |
| trays[].x/y/w/h | 必填 | 托盘左上位置及正尺寸，px |
| trays[].label | 必填 | 最多 6 字；按 Unicode 码点计数 |
| trays[].paper | 必填 | `[c1,c2]`，180deg 纸色渐变 |
| trays[].hue | 可选 | `[c1,c2,c3]`，90deg 色带渐变 |
| objects | 必填数组 | 物件列表 |
| objects[].id | 必填 | 唯一非空字符串 |
| objects[].w/h | 必填 | 正尺寸，px |
| objects[].markup | 必填 | 自包含内联 SVG 字符串，作为 img 的 data URL |
| objects[].from | 必填 | `{x,y}`，初始左上位置 |
| objects[].to | 必填 | `{tray,x,y}`；tray 为托盘 id，x/y 为相对托盘左上的目标偏移 |
| objects[].at | 必填 | 移动开始秒数 |
| objects[].dur | 0.8 | 正移动时长，秒 |
| trayIn | 必填 | `{at,dur?}`；所有托盘统一入场，dur 默认 0.45 秒且须为正 |
| leaders | 可选 | 省略时不创建指示线 |
| leaders.mount | 启用时必填 | `data-hf-layer="overlay"` 宿主内元素 |
| leaders.color | `#ffd48a` | 线条颜色 |
| leaders.width | 5 | 正线宽，px |

stage 与 overlay mount 使用相同的 1920×1080 舞台坐标原点。目标绝对位置始终为托盘静止坐标加 to 偏移，不跟随托盘入场的临时位移；镜头表应安排托盘先入场，再让物件归位。未知 tray id、重复 id、超长 label、缺失几何或时刻、非正尺寸或时长会抛出 TypeError，校验先于 DOM 创建。

## apply(t) 时间线

- 创建时执行 `apply(0)`；物件在各自 from 处可见。
- 托盘在 `trayIn.at .. at+dur` 按 out3 从下方 34px 上浮并淡入，之后保持。
- 物件在自身 `at .. at+dur` 按 `kit.ease.inOut` 插值左上 x/y。
- 落定后的 0.12 秒内，以中心为原点线性缩放 `1 → 1.07 → 1`，峰值在落定后 0.06 秒。
- 每条虚线连接物件初始中心与当前中心，仅在闭区间 `[at-0.1,at+dur+0.25]` 显示，opacity 为 0.5；区间外为 0。
- 每次调用都重算位置、缩放、线端点及显隐，支持冷 seek、重复和倒序 seek。

返回 `{root,apply,dispose,object}`；`object(id)` 返回物件 img，未知 id 返回 undefined。工程可取节点用于后续动作；后续调用 apply 会重写其 left/top/transform/opacity/visibility，接管时须避免争写。dispose 幂等地删除 stage 根和 overlay 根，之后 apply 无操作。

## DOM 与类名

所有样式由 `ensureCss('hf-kit-tray-sort', ...)` 注入一次。

- `div.hf-kit-tray-sort-root`：stage 根，绝对定位。
- `div.hf-kit-tray-sort-tray`：托盘；包含可选 `div.hf-kit-tray-sort-hue` 色带及 `div.hf-kit-tray-sort-label` 标签。
- `img.hf-kit-tray-sort-object`：与托盘同级的物件。
- `div.hf-kit-tray-sort-leaders`：overlay 根。
- `svg.hf-kit-tray-sort-svg`：`viewBox="0 0 1920 1080"`；包含每物件一条 `path.hf-kit-tray-sort-leader`。

HTML 节点通过 kit.make + kit.abs 创建。由于核心 kit.make 使用 HTML createElement，SVG 与 path 通过静态 SVG 标记解析获得正确命名空间，再逐节点 kit.abs；不修改核心。所有显隐通过 kit.shown 配对写入。

## 镜头表这一行

| 时间 | 层 / 积木 | 参数与动作 |
| --- | --- | --- |
| 6.15–8.12s | stage / tray.sort + overlay 指示线 | 暖色托盘 (560,770,430,210)，6.15s 上浮；物件从 (620,500) 于 7.2s 移到托盘内 (80,70)，0.8s 后归位强调 |

```js
var sorted = HarnessStageKit.create('tray.sort', {
  mount: stageLayer,
  trays: [{ id: 'warm', x: 560, y: 770, w: 430, h: 210,
    label: '暖色', paper: ['#fbe6cf', '#f0c39c'],
    hue: ['#e0563c', '#e59a2e', '#e8c53a'] }],
  objects: [{ id: 'red', w: 80, h: 80,
    markup: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle cx="40" cy="40" r="36" fill="#e0563c"/></svg>',
    from: { x: 620, y: 500 }, to: { tray: 'warm', x: 80, y: 70 }, at: 7.2 }],
  trayIn: { at: 6.15 },
  leaders: { mount: overlayLayer }
});
// 由宿主 renderAt(t) 调用 sorted.apply(t)。
```

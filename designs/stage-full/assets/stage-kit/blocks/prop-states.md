# prop.states

把本期专属的物写成数据：分几块（parts）、有哪些命名状态（states）、在哪些时刻切到哪个状态（steps）。积木负责定位、显隐、纸艺皮肤和确定性插值；物长什么样由工程决定。

闸门、卡纸堆、抽屉、流水线这类每期不同的物都用它做，不必等卡片预置专属积木；`prop.stand`、`sign.plate` 等通用动作仍可直接用。

## options

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| mount | Element | 是 | 第 2 层 `data-hf-layer="stage"` 内的元素 |
| box | {x,y,w,h} | 是 | 道具外框，相对 mount 的像素；宽高须大于零 |
| perspective | number | 否 | 道具内部透视距离，默认 1400 |
| parts | Array | 是 | 部件清单，数组顺序即叠放顺序 |
| parts[].id | string | 是 | 部件标识，道具内唯一 |
| parts[].box | {x,y,w,h} | 是 | 相对道具外框的位置与尺寸 |
| parts[].origin | string | 否 | CSS 变换原点，默认 `50% 50%`；门板绕顶边翻用 `50% 0`，绕左边开用 `0 50%` |
| parts[].look | object | 是 | 外观，见下表 |
| states | object | 是 | `{ 状态名: { 部件id: 姿态 } }`；状态只写它改变的部件与轴 |
| start | string | 是 | 初始状态名 |
| steps | Array | 是 | 按时间递增、互不重叠的切换清单 |
| steps[].at | number | 是 | 全片秒数 |
| steps[].to | string | 是 | 目标状态名 |
| steps[].dur | number | 否 | 每个部件的过渡时长，默认 0.5 |
| steps[].stagger | number | 否 | 本步改变的部件按 parts 顺序依次错开的秒数，默认 0 |
| steps[].ease | string | 否 | `linear / inOut / out2 / out3 / inOut3 / sineInOut / quintOut / backOut`，默认 `out3` |

look：

| kind | 字段 | 说明 |
| --- | --- | --- |
| `img` | src、alpha（必须显式 true/false）、fit（`contain`/`cover`）、position | alpha=true 为镂空道具；alpha=false 自动加纸边与投影，变成纸片，不会以带背景的方块直接上台。用 `fit:'cover'` + `position` 可以把一张图切成几块（如三扇闸门各取 0% / 50% / 100%） |
| `svg` | markup 或 src | 内联 SVG 以图片数据地址呈现 |
| `paper` | color、radius | 纯色纸片，带纸边与投影 |
| `label` | text（1–8 字）、size、ink、paper | 第 2 层附着短标注，如闸门名牌；独立解释仍放第 4 层 |

姿态（pose）轴：`x`、`y`（像素位移）、`r`（平面旋转°）、`rx`、`ry`（3D 翻转°）、`s`（缩放）、`o`（不透明度 0–1）。未写的轴取上一状态的值；start 里没写的部件为静止姿态 `{x:0,y:0,r:0,rx:0,ry:0,s:1,o:1}`。

参数缺失、未知部件、未知轴、非有限数值、步骤重叠都会抛 TypeError。

## apply(t) 时间线

- 创建时执行 `apply(0)`；`apply(t)` 是全片秒数的纯函数，支持任意 seek、倒放、重复调用。
- 第 k 步开始前，各部件保持前 k 步累积出的状态；第 k 步内，本步改变的部件从上一状态插值到目标状态，第 j 个部件起点为 `at + j*stagger`。
- 一步结束（`at + dur + stagger*(改变件数-1)`）之前，下一步不得开始。
- 不透明度经 `kit.shown` 成对写 opacity 与 visibility。

## DOM 与类名

```text
mount
└─ div.hf-kit-prop-states-root（root，绝对定位，带 perspective）
   └─ div.hf-kit-prop-states-part（每件一个；按 look 追加 -framed / -paper / -label）
      └─ img.hf-kit-prop-states-img（img、svg 件）
```

全部规则由 `hf-kit-prop-states` 样式块注入。工程不得另外改写部件 transform；需要额外动作就再加一个状态。`dispose()` 移除 root，可重复调用。

## 镜头表写法：三道闸门

| cue | 物 | 动作 | 做法 |
| --- | --- | --- | --- |
| 三道门禁 | 三扇闸门 | 依次从台面升起、关闭 | prop.states start=`down`，step `closed`（stagger 0.25） |
| 第一道门是文案门 | 第一扇闸门 | 挂上名牌，盖章后向上打开、放行灯变绿 | step `tag1` → `open1` |
| 三道门禁层层把关 | 三扇闸门 | 全部落下关好 | step `shut` |

```js
kit.create('prop.states', {
  mount: stageHost, box: { x: 300, y: 300, w: 1320, h: 560 },
  parts: [
    { id: 'g1', box: { x: 0, y: 60, w: 420, h: 480 }, origin: '50% 0',
      look: { kind: 'img', src: 'assets/gates.png', alpha: false, fit: 'cover', position: '0% 50%' } },
    { id: 'lamp1', box: { x: 180, y: 0, w: 60, h: 60 }, look: { kind: 'paper', color: '#4caf6a', radius: 30 } },
    { id: 'tag1', box: { x: 110, y: 470, w: 200, h: 56 }, look: { kind: 'label', text: '文案门' } }
    // g2 / g3 与各自的 lamp、tag 同理
  ],
  states: {
    down:   { g1: { y: 200, o: 0 }, lamp1: { o: 0 }, tag1: { o: 0 } },
    closed: { g1: { y: 0, o: 1 } },
    tag1:   { tag1: { o: 1 } },
    open1:  { g1: { rx: -70 }, lamp1: { o: 1 } },
    shut:   { g1: { rx: 0 }, lamp1: { o: 0 } }
  },
  start: 'down',
  steps: [
    { at: 230.2, to: 'closed', dur: 0.5, stagger: 0.25 },
    { at: 236.0, to: 'tag1', dur: 0.3 },
    { at: 238.0, to: 'open1', dur: 0.6, ease: 'backOut' },
    { at: 280.0, to: 'shut', dur: 0.6 }
  ]
});
```

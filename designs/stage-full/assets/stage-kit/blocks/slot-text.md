# slot.text

在第 4 层预留固定阅读槽位，让文字卡片确定性进退场，并在 B 接管时冻结和虚化。

## options

| 字段 | 类型 | 必填 | 含义 |
|---|---|---|---|
| mount | Element | 是 | 位于 `data-hf-layer="text"` 宿主内的元素，可直接使用宿主 |
| box | {x,y,w,h} | 是 | 根节点绝对位置与尺寸，单位 px；宽高必须大于 0 |
| slots | integer | 是 | 1–4 个槽位，竖排等分且永不重排 |
| gap | number | 否 | 槽间距，默认 18px，非负且必须留下正数槽高 |
| entries | Array | 是 | 条目列表，可为空 |
| entries[].id | string | 是 | 非空且唯一，写入 `data-info-id` |
| entries[].slot | integer | 是 | 槽位编号，从 0 起，小于 slots |
| entries[].html | string | 是 | 卡片内容，由工程提供可信 HTML；不做清洗，不应包含独立动画、事件或覆盖卡片定位的样式 |
| entries[].at | number | 是 | 全片绝对入场秒数 |
| entries[].hold | number | 否 | 入场完成后的最短阅读时长，默认 1.5 秒，不能小于 1.5 |
| entries[].out | number | 否 | 全片绝对退场起点；省略则永久保留；必须不早于 `at+0.45+hold` |
| entries[].outDur | number | 否 | 退场时长，默认 0.35 秒，必须大于 0 |
| dim | Array<{from,to}> | 是 | B 接管的全片绝对区间，无接管时传 `[]`；要求 to > from；重叠或相接区间合并为一次连续接管 |
| style | Object | 否 | 纯风格参数 |
| style.ink | string | 否 | 墨色，默认 `#292620` |
| style.paper | string | 否 | 纸色，默认 `#fffaf0` |
| style.size | number | 否 | 字号 px，默认 40（v6 起），必须为正；字体族继承宿主 |

几何与时间使用核心校验函数读取，缺失必填项抛出 TypeError。同槽占用区间为 `[at, out+outDur)`，永久保留的条目占用至无限远；任意重叠均在 create 时抛出 TypeError，端点相接允许。非法参数在创建 DOM 之前拒绝。

## apply(t) 时间线

- `t < at`：卡片隐藏，下移 14px。
- `[at, at+0.45)`：使用 `kit.ease.out3`，从下移 14px 回到固定槽位，透明度从 0 到 1。
- `[at+0.45, out)`：位置与可读性保持不变；省略 out 则持续保留。hold 从入场完成后起算，不触发自动退场。
- `[out, out+outDur)`：使用 `kit.ease.out3`，向上移动 10px，透明度从 1 到 0。
- `t >= out+outDur`：隐藏，保持上移 10px 的末态。

在 dim 的 `[from,to)` 内，整组通过 `kit.shown(root, 0.28)` 虚化，各条目的视觉进度均取 from 时刻。dim 不改变时钟或延长 hold；在 to 恢复组透明度 1，立即按绝对 t 求值。为保证「B 结束后恢复 A 离开时的状态」：任何条目的退场窗口 `[out, out+outDur)` 不得与 dim 区间相交，否则 create() 抛 TypeError；因此 B 开始时可见的条目返回时仍然可见、位置不变。`at` 落在 dim 内的条目在 to 直接就位（不重播入场），这对应「已读内容直接就位，未讲内容继续跟随口播揭示」；工程应把 A 的新要点排在返回 A 之后。若返回时仍处于某条目的入场时间段，直接取该时刻进度。

create 显式执行 apply(0)。每次 apply 从 t 重建所有显隐与位移，支持重复、倒序和任意 seek。dispose 移除根节点，可重复调用；之后 apply 不再写 DOM。

## DOM 与类名

- 根 div：`hf-kit-slot-text-root`，按 box 绝对定位，承载整组虚化。
- 每条目一个卡片 div：`hf-kit-slot-text-card`，包含 `data-info-id` 和传入 HTML；位置为 `x=0`、`y=slot*(槽高+gap)`，宽为 box.w。

槽高为 `(box.h-gap*(slots-1))/slots`。所有积木节点由 kit.make 创建并用 kit.abs 定位，显隐只用 kit.shown；两种类名的全部规则由 `kit.ensureCss('hf-kit-slot-text', CSS_TEXT)` 注入。卡片提供纸底、墨字、圆角、内边距和轻投影，溢出裁切。工程须预留足够空间，不能靠缩字号规避阅读保护。

## 镜头表

| 时间 | 所在层 | 舞台动作 | 参数与内容 |
|---|---|---|---|
| 0–6 秒 | 第 4 层 text | slot.text | box={x:120,y:160,w:640,h:360}，slots=2，gap=18；条目 id=point-a、slot=0、html=关键结论、at=0、hold=1.5、out=5；dim=[{from:2,to:4}] |

加载顺序为 stage-kit.js → blocks/slot-text.js → 工程脚本；使用 `HarnessStageKit.create('slot.text', options)`，由工程统一传入全片秒数。

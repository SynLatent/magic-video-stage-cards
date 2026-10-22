# rig.rebuild

将纸舞台依次折叠、后退、换皮肤并重新展开，用于换地点。

## options

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| rig | 对象 | 是 | `HarnessStageRig.createPaperStage` 返回值，含 `root` 和 `apply(state)` |
| wrapper | Element | 是 | rig.root 的直接父元素，位于 `data-hf-layer="stage"` 宿主内，不能是 rig.root |
| at | number | 是 | 折叠起点，全片秒数 |
| phases | 对象 | 否 | 各阶段时长（秒）；省略的字段采用下表默认值，显式值必须有限且非负，0 表示瞬时完成 |
| phases.props | number | 否 | 道具折下，默认 0.25 |
| phases.outer | number | 否 | 外板折叠，默认 0.45 |
| phases.inner | number | 否 | 内板与地面同步折叠，默认 0.45 |
| phases.recede | number | 否 | 包装层后退，默认 0.55 |
| phases.hold | number | 否 | 折叠后停顿，默认 0.2 |
| phases.inner2 | number | 否 | 内板展开，默认 0.5 |
| phases.floor2 | number | 否 | 地面落下，默认 0.45 |
| phases.outer2 | number | 否 | 外板展开，默认 0.5 |
| phases.props2 | number | 否 | 道具立起，默认 0.4 |
| skin | 对象 | 是 | 换景皮肤参数 |
| skin.before | string | 是 | 重建前类名；单个类名或空字符串 |
| skin.after | string | 是 | 重建后类名；单个类名或空字符串，如 `is-cool` |
| skin.target | Element | 是 | 皮肤类所属元素；其他类保持不变 |
| recede | 对象 | 是 | 包装层后退参数，无静默默认值 |
| recede.y | number | 是 | 后退终点 Y 位移，像素，如 40 |
| recede.scale | number | 是 | 后退终点缩放，必须大于 0，如 0.92 |

## apply(t) 时间线

各阶段严格按表中顺序累计，从 `at` 开始。默认总时长 3.75 秒；下表起止均相对 `at`，覆盖时长后按相同顺序重新累加。

| 阶段 | 默认起止（秒） | 动作与缓动 |
| --- | --- | --- |
| props | 0–0.25 | prop 1→0，`kit.ease.inOut` |
| outer | 0.25–0.70 | outer 1→0，`kit.ease.inOut` |
| inner | 0.70–1.15 | inner、floor 同时 1→0，同起点、同一时长，`kit.ease.inOut` |
| recede | 1.15–1.70 | wrapper 从 Y=0、scale=1 到 recede，`kit.ease.inOut3` |
| hold | 1.70–1.90 | 保持完全折叠与后退状态，仍使用 before |
| inner2 | 1.90–2.40 | 起点在折叠态切换到 after；inner 0→1，`kit.ease.inOut` |
| floor2 | 2.40–2.85 | floor 0→1，`kit.ease.inOut` |
| outer2 | 2.85–3.35 | outer 0→1，`kit.ease.inOut` |
| props2 | 3.35–3.75 | prop 0→1，`kit.ease.inOut` |

wrapper 从 inner2 起点到 props2 末尾，在整个重建区间按 `kit.ease.inOut3` 返回 `translateY(0px) scale(1)`。起点之前四个铰链量均为 1，使用 before；完成之后四个量均为 1，使用 after。没有整体淡出。

创建时立即调用 `apply(0)`。每次 apply 都从全片秒数 t 重建四个铰链量、wrapper transform 与皮肤类，支持重复、倒序和跨阶段 seek；倒退越过换肤点会恢复 before。before/after 可以相同或为空，其他类不受影响。

## DOM 与所有权

结构为 `section[data-hf-layer="stage"] → wrapper → rig.root`。本积木返回已有 wrapper 作为 `root`，不创建节点、不添加积木类、不注入 CSS，也不改变宿主显隐和定位；这是重建积木对公共建节点合同的特例。DOM 类名清单：无新增类；skin 的两个类由工程提供样式。

与 GUIDE §3 一致：铰链角度归 rig，位移与缩放归 wrapper。本积木通过 rig.apply 和 wrapper.style.transform 统一驱动这两者；接管期间工程不得另行驱动这些状态，也不得对 rig.root 写 transform。wrapper 在接管期间使用本积木的位移/缩放，不叠加创建前的内联 transform。

`dispose()` 不移除 wrapper：恢复 create 之前 wrapper 的内联 transform 字符串，以及 skin.target 上 before/after 两个类各自原始的有无；铰链统一回到全部展开 `rig.apply({inner:1,outer:1,floor:1,prop:1})`，不恢复旧铰链姿态。重复 dispose 无副作用，销毁后的 apply 不再写 DOM 或调用 rig。

## 镜头表用法

| 镜头 | 舞台动作 | 参数与安排 |
| --- | --- | --- |
| 换地点 | rig.rebuild | at=12，recede={y:40,scale:0.92}，skin 从空类切换到 is-cool；默认 15.75 秒完成重建 |

工程先加载 stage-kit 核心与本积木，再传入已有 rig、wrapper 和皮肤目标创建 `kit.create('rig.rebuild', options)`；在工程统一的 renderAt(t) 中调用 apply(t)。

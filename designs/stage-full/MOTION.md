# stage-full · 动作清单

本卡的全部标准动作，外加本卡独有动作，都在下表。只用表里的动作名，不手写缓动或关键帧；怎么动由本卡决定。

```js
var motion = HarnessMotion.create({ card: 'stage-full' });   // 先加载 runtime/motion.js，再加载卡内 stage-motion（Work 里的路径见 GUIDE §10）
motion.appear([box1, box2, box3], { at: 2.4, stagger: { span: 0.3 } });
motion.sortTo(box2, { at: 5.1, to: { x: 260, y: 40 } });
motion.transition({ outgoing: [box1, box2, box3], incoming: [lamp] }, { at: 9 });
function renderAt(t) { motion.apply(t); }                     // 交给 HarnessScene.bindScene
```

| 动作 | 名称 | 表达什么 | 适合 | 本卡怎么动 | 必填 | 可选 | 默认时长 |
|---|---|---|---|---|---|---|---|
| `appear` | 出现 | 物体进入画面并停稳 | 新物体登场；按口播逐个揭示 | 纸片沿底边铰链从平躺立起，带一点过冲后停稳 | at | duration、strength、stagger | 0.6 s |
| `exit` | 退场 | 物体离开画面 | 讲完的物体让位 | 纸片沿底边铰链向后折倒，躺平后消失 | at | duration、strength、stagger | 0.24 s |
| `emphasize` | 强调 | 让已在场的物体被注意一下，结束后复原 | 口播点到这个物体 | 纸片被轻轻提起、左右晃一下再放回原位 | at | duration、strength | 0.6 s |
| `moveTo` | 移动到 | 在场物体换到新位置 | 归类、排序、靠拢、对比 | 沿弧线跳到 to，途中朝前进方向微倾 | at、to | duration、strength、stagger | 0.6 s |
| `settle` | 落定 | 已到位的物体表现落稳的分量 | 放下、盖章、归位后的那一下 | 纸片在铰链上前后晃两下停稳（冲击 + 小回弹） | at | duration、strength | 0.6 s |
| `transition` | 换场 | 一组物体交给另一组物体 | 同一舞台上换一批物体；列表按从后排到前排排列 | 旧物按列表顺序依次折倒，新物再按顺序立起；整台换地点用背景动作换景 | at | duration、strength | 1.2 s |
| `sortTo` | 归位（本卡独有） | 物体沿弧线落进指定位置并晃稳 | 分组、归托盘、放进容器 | 弧线跳到 to，落下后在铰链上晃两下停稳 | at、to | duration、strength、stagger | 0.9 s |

## 背景动作（两张舞台卡共用）

背景只有一块纸板：展开后背板铺满地平线以上，台面铺满地平线以下，后面不再垫第二层底。前景物体站在台面上，在换景开始前退场、换景完成后再出现。

```js
var backdrop = HarnessStageRig.createBackdrop({ mount: backgroundLayer, horizon: 700,
  skins: { warm: { wall: ['#f7ecd8', '#e6cfa8'], floor: ['#dcbd8e', '#c49a63'] },
           cool: { wall: ['#e4eff7', '#b4cde0'], floor: ['#b9d3e6', '#8fb2cd'] } } });
backdrop.unfold({ at: 0.2 });
backdrop.refold({ at: 7.2, skin: 'cool' });
backdrop.fold({ at: 13.6 });
function renderAt(t) { backdrop.apply(t); motion.apply(t); }
```

| 动作 | 名称 | 表达什么 | 本卡怎么动 | 必填 | 可选 | 默认时长 |
|---|---|---|---|---|---|---|
| `backdrop.unfold` | 展开 | 开场搭景 | 内板先开、地面落下、外板随后、道具立起，铺满全屏 | at | duration | 2.0 s |
| `backdrop.refold` | 换景 | 换地点 | 折起，折住时换皮，再在原地展开成新地点 | at、skin | duration | 3.0 s |
| `backdrop.fold` | 收起 | 收尾 | 道具倒下、外板合拢、内板与地面收起 | at | duration | 1.2 s |

- `horizon`：地平线 y，默认 700；`panels`：背板块数，stage-full 用 4，stage-light 用 2。
- `skins`：每种皮肤给背板、台面各两种颜色（上、下）；第一种是开场皮肤。
- 顺序必须是 展开 → 换景…… → 收起，动作之间不能重叠，不合法会直接报错。

### 进阶背景：纸板展开 + 小素材堆叠 + 整体旋转

用 `disc.scene` 积木（见 GUIDE §10），给每个景加 `board`。每次换景整个圆盘转半周，转正后本景的纸板先展开，小素材（天空件、吊挂件、道具）再逐件落到纸板上，三个动作都在同一层背景里。

```js
kit.create('disc.scene', { mount: backgroundLayer, base: 'assets/stage/',
  scenes: [{ id: 'harbour', color: '#10141d', board: { wall: ['#f6e7c8', '#e7c996'], floor: ['#d8b783', '#bf9259'] },
             pieces: [{ id: 'sun', kind: 'sky', x: 1420, y: 70, w: 200, h: 200, file: 'sun.png' }] }, /* … */],
  entries: [{ scene: 'harbour', turnAt: null, buildAt: 0.2 }, { scene: 'night', turnAt: 8, buildAt: 10.2 }] });
```

用了进阶背景就不再另放 `createBackdrop`，背景只有圆盘这一层。

## 参数

- `at`：全片秒数，取口播 cue 的语义起点。
- `duration`：`quick`（0.24 s）、`standard`（0.6 s）、`scene`（1.2 s），或直接写秒数。不写时每件用默认时长，错峰另加；写了就是整组从第一件开始到最后一件结束的总时长。
- `strength`：`soft`、`normal`（默认）、`strong`，只改幅度，不改时长和终态。
- `stagger`：`{ span, order }`。一组物体从第一个到最后一个开始的时间差，`order` 为 `forward` 或 `reverse`。
- `to`：`{ x, y }`，相对物体布局原位的像素偏移，不是相对上一次位置。
- `transition` 的第一个参数是 `{ outgoing, incoming }` 两组物体。

## 规则

1. 物体的布局原位用 CSS 定位写好；动作拥有它的 transform、opacity、visibility，工程不要再写这三项。
2. 同一物体同一时段只能有一个动作驱动同一属性；重叠时添加会直接报错，把它们在时间上错开。
3. `appear` 和 `sortTo` 已经包含落稳，不要紧接着再加 `settle`；`settle` 留给独立的放下、盖章。
4. 下一个动作从上一个动作的结束状态开始，不必重复写起点。
5. 换地点用上面的背景动作；聚光、写牌子这类舞台机械仍按 GUIDE §10 的积木做。

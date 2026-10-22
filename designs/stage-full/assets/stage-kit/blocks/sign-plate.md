# sign.plate

将 1–12 字写在第 2 层纸牌道具上，支持脚铰链立起、逐字写出与反向折下。

这是第 2 层附着文字（字在物上），不是第 4 层正文；不受第 4 层 A1，但受 ≤12 字限制。先加载 `stage-kit.js`，再加载 `blocks/sign-plate.js`。

## Options

| 参数 | 必填 / 默认 | 说明 |
| --- | --- | --- |
| `mount` | 必填 | 位于 `data-hf-layer="stage"` 宿主内的元素 |
| `box` | 必填 | `{ x, y, w, h }`，纸牌位置与尺寸，px；宽高必须为正。立柱额外向下延伸 `h * 0.35` |
| `text` | 必填 | 1–12 字的纯文本；按 Unicode 码点计数，扩展汉字的代理对算一个字；标点和空格也计数，不解析 HTML |
| `at` | 必填 | 开始立起的全片秒数 |
| `dur` | `0.45` | 立起第一段时长，正数；另有固定 `0.16` 秒回稳 |
| `write` | 省略 | `{ at, dur }`，两字段必填、dur 为正；省略时随立起整句显示 |
| `out` | 省略 | `{ at, dur? }`，at 必填，dur 默认采用立起 dur；反向折下，省略则保持 |
| `style.ink` | `#2a2018` | 字色 |
| `style.paper` | `#fdf3dd` | 纸牌和立柱颜色 |
| `style.size` | `34` | 正数字号，px；字体继承宿主 |

缺失几何或必填时刻、非有限数值、非正尺寸或时长、错误宿主、文字越界均抛 `TypeError`。文字按每字一个字号宽居中排列，镜头作者应提供能容纳整句的 box。

## apply(t) 时间线

- 创建后立即 `apply(0)`。`t < at` 时所有节点隐藏，铰链角度为 88°。
- `at .. at + dur` 使用 `kit.settle(t, at, dur, 0.16)` 第一段，从 88° 到 -1.5°；随后 0.16 秒回稳至 0°。旋转原点为 `50% 0`。
- 指定 write 时，可见字数严格为 `floor(kit.ramp(t, write.at, write.at + write.dur) * 字数)`；每字经 `kit.shown` 独立控制，整牌未出现或已退场时所有字都隐藏。
- out 开始后，从 `enteringAngle(out.at)` 按 out3 折回 88°，期间保持不透明，折完隐藏；即使 out 与立起重叠也连续衔接。
- 每次 apply 从全片秒数重建角度与全部显隐，支持重复、倒序 seek。`dispose()` 幂等移除自身根节点，之后 apply 无操作。

## DOM 与样式

所有真实节点都由 `kit.make` + `kit.abs` 创建，CSS 由 `kit.ensureCss('hf-kit-sign-plate', CSS_TEXT)` 单次注入。

```text
foot.hf-kit-sign-plate-foot [data-hf-kit-foot]
└─ plate.hf-kit-sign-plate-paper
   ├─ line.hf-kit-sign-plate-text
   │  └─ span.hf-kit-sign-plate-char × 字数
   └─ ::after（CSS 立柱，无额外 DOM）
```

纸牌圆角 18px；白边 `inset 0 0 0 6px rgba(255,255,255,.9)`；投影 `8px 10px 0 rgba(45,28,12,.2)`。立柱在牌子下方居中，宽 14px，高 `box.h * 0.35`，继承纸色。宿主负责舞台透视。

## 镜头表写法

| 镜头 | 层 / 积木 | 参数与动作 |
| --- | --- | --- |
| 共同点出现 | 第 2 层 / `sign.plate` | box=(1052,640,260,110)，text=共同点；13.2 秒立起，13.7 秒起用 0.6 秒写完，15.35 秒起用 0.4 秒折下 |

```js
var sign = HarnessStageKit.create('sign.plate', {
  mount: stageLayer,
  box: { x: 1052, y: 640, w: 260, h: 110 },
  text: '共同点', at: 13.2,
  write: { at: 13.7, dur: 0.6 },
  out: { at: 15.35, dur: 0.4 }
});
// 由工程的 renderAt(t) 调用 sign.apply(t)。
```

# inset.broll

在第 2 层以纸框滑入图片、视频或节点局部镜头，支持确定性缩放、平移与附着短标注。

## 参数

| 字段 | 类型 | 必填 | 含义 |
|---|---|---|---|
| mount | Element | 是 | 位于 `data-hf-layer="stage"` 宿主内 |
| box | {x,y,w,h} | 是 | 纸框外边界，像素；宽高须大于 20，以容纳双侧各 10 像素纸边 |
| safe.bottom | number | 是 | 字幕安全带上沿；框底超过此值抛 TypeError |
| media.kind | string | 是 | `img`、`video` 或 `node` |
| media.src | string | 图片、视频必填 | 媒体地址，由工程供应 |
| media.node | Element | 节点必填 | 将现有节点挂进内容包装层；节点随积木移除，不恢复原父节点；内部内容由工程负责 |
| enter.from | string | 是 | `left`、`right`、`bottom` |
| enter.at | number | 是 | 全片入场起点，秒 |
| enter.dur | number | 否 | 正数，入场时长；默认 0.5 秒 |
| exit | {at,dur?} | 否 | 退场配置；省略则留在场内 |
| exit.at | number | 提供 exit 时必填 | 不早于入场完成的全片退场起点 |
| exit.dur | number | 否 | 正数，默认 0.4 秒 |
| move | object | 否 | 缩放与平移；省略则保持原始尺寸、零平移 |
| move.zoom | [number,number] | 提供 move 时必填 | 起止正数缩放，例如 `[1,1.12]` |
| move.pan | [[number,number],[number,number]] | 提供 move 时必填 | 起止像素平移，例如 `[[0,0],[20,-10]]` |
| move.dur | number | 无 exit 且有 move 时必填 | 正数，从入场完成起算的运动时长 |
| label | {text,side,size} | 否 | 第 2 层图形附着标注，不承载独立解释正文 |
| label.text | string | 提供 label 时必填 | 至多八个 Unicode 码点，超出抛 TypeError |
| label.side | string | 提供 label 时必填 | `top` 或 `bottom`；贴在框边内侧 |
| label.size | number | 否 | 标注字号 px，正数；省略时继承宿主字号。纸框推到台面区 60% 以上时建议 ≥ 32 |

缺少必填几何或时刻、非有限数值、非法媒体类型或方向都会抛 TypeError。字体继承宿主。几何与字幕安全带使用同一坐标系；底部滑入途中的位移由宿主舞台边界及上层字幕遮罩处理，安全检查针对静止框边界。

## 时间线

- 创建时显式执行 `apply(0)`。`apply(t)` 接全片秒数，可前进、回拖和重复调用。
- `enter.at` 前：框在指定方向偏移 `max(260, box.w*0.3)` 像素并隐藏。
- `enter.at` 至 `enter.at+enter.dur`：按 `out3` 滑入并显示；运动内容保持 move 首值。
- 运动起点为入场完成；结束时刻取 `exit.at` 和「入场完成 + move.dur」中已提供值的较早者。中间按 `sineInOut` 插值，结束后保持末值。结束与起点相同则在该时刻直接取末值。move 存在但两个结束条件都缺失时创建抛 TypeError。
- `exit.at` 至 `exit.at+exit.dur`：按 `out3` 向原入场方向退回并隐藏；内容运动保持末值。没有 exit 则纸框持续在场。
- 视频静音、行内播放、不自动播放。每次 apply 将目标时间设为 `clamp(t-enter.at,0,duration)`，只要 currentTime 与目标不同就写回（不设容差，同一 t 得到同一帧）；元数据未就绪时不写，等待后续 apply，禁止用事件回调驱动画面。媒体解码及 seek 完成仍由浏览器负责，宿主截图须等待帧就绪。
- `dispose()` 移除根节点；重复调用安全，后续 apply 不再写 DOM。

## DOM 与类名

所有自建元素经 `kit.make`、`kit.abs` 创建定位，显隐由 `kit.shown` 成对写入。样式通过 `hf-kit-inset-broll` 唯一标识注入。

| 层级 | 类名 | 职责 |
|---|---|---|
| 根 | hf-kit-inset-broll-root | 纸色边框、圆角、偏移投影、进退位移 |
| 根内 | hf-kit-inset-broll-window | 裁切内容窗 |
| 内容窗内 | hf-kit-inset-broll-media | img、video 或节点包装层；承担内容缩放平移 |
| 内容窗内 | hf-kit-inset-broll-shade | 内阴影，不接收指针事件 |
| 根内，可选 | hf-kit-inset-broll-label | 框边附着短标注 |

传入的 media.node 是工程自有内容，不由积木创建，其内部样式和静态内容由工程供应。不得以该节点夹带独立时钟驱动动画。

## 镜头表

| 时段 | 舞台动作 | 参数与内容 | 字幕保护 |
|---|---|---|---|
| 2–7.4 秒 | inset.broll | B 接管：box={x:300,y:210,w:1320,h:660}（约占台面区 2/3），左侧滑入局部图片，enter.at=2，exit.at=7，move.zoom=[1,1.12]，move.pan=[[0,0],[16,-8]]，顶部标注“局部细节” | box 底边不超过 safe.bottom |

B 接管时纸框约占台面区 60% 以上，A 虚化或退场；小纸框只作贴在物旁的附着证据，不单独撑起一镜。

B 接管期间 A 文字的冻结与恢复、独立 B 文字及字幕叠放由宿主负责；本积木只管理第 2 层纸框镜头。

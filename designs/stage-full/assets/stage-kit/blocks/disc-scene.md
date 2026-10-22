# disc.scene

在第 1 层背景中用一个刚性圆盘完成半周换景，并按组逐件装配工程自备的布景位图。

## options

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| mount | Element | 是 | 位于 `data-hf-layer="background"` 宿主内的挂载元素 |
| base | string | 是 | 工程自备位图目录，例如 `assets/stage/`；与 file、backdrop 直接拼接，目录应带末尾斜杠 |
| scenes | Array | 是 | 场景定义，id 不可重复 |
| scenes[].id | string | 是 | 场景标识 |
| scenes[].color | string | 是 | 场景面板与对应半边的 CSS 底色 |
| scenes[].backdrop | string | 否 | 空布景位图文件，相对 base；铺满面板 |
| scenes[].board | object | 否 | 进阶背景：本景自带一块全屏纸板（背板在上、台面在下），转正后在 buildAt 展开，小素材随后逐件堆叠。需先加载 `runtime/stage-rig.js` |
| board.wall / board.floor | [string, string] | 随 board 必填 | 背板、台面的上下两端颜色 |
| board.horizon | number | 否 | 地平线 y，默认 700 |
| board.panels | 4 或 2 | 否 | 背板块数，默认 4 |
| scenes[].pieces | Array | 是 | 部件清单；数组顺序决定绘制叠放顺序 |
| pieces[].id | string | 是 | 景内唯一部件标识 |
| pieces[].file | string | 是 | 相对 base 的位图文件 |
| pieces[].x / y / w / h | number | 是 | 面板内的绝对像素位置与尺寸 |
| pieces[].origin | string 或 [number, number] | 否 | CSS 变换原点或局部像素坐标，默认 `50% 100%` |
| pieces[].kind | string | 是 | 装配类型，见下表；其他类型按普通道具处理 |
| pieces[].motion | string | 否 | `left / right / rise / drop / fold`，优先于 kind |
| pieces[].group | string | 否 | 同组部件共用装配起点，各件保留自身 kind/motion 位姿 |
| pieces[].order | number | 否 | 覆盖 kind 的装配排序值；不改变绘制顺序 |
| pieces[].finish | boolean | 否 | 为 true 时在装配最后 0.15 秒的起点直接显示，无位移动作 |
| entries | Array | 是 | 按换景顺序排列的出场清单，同景可重复使用 |
| entries[].scene | string | 是 | scenes 中的 id |
| entries[].turnAt | number 或 null | 是 | 换景起点；只有第 0 条可为 null，此时从 0 秒显示 |
| entries[].buildAt | number | 是 | 装配起点，单位秒 |
| entries[].buildDur | number | 否 | 装配时段，默认 4.2 秒 |
| turnDur | number | 否 | 每次半周转动时长，默认 2.2 秒 |
| boardDur | number | 否 | 有 board 的景纸板展开时长，默认 1.6 秒；小素材在其后的 buildDur − boardDur 内装配，至少留 1 秒 |
| disc | object | 否 | 整项省略使用直径 4400、圆心 [960,1080]；传入时须完整给出下两项 |
| disc.diameter | number | 随 disc 必填 | 圆盘直径，像素 |
| disc.centre | [number, number] | 随 disc 必填 | 宿主坐标中的圆心 |

几何、时刻必须是有限数值；时长与直径须为正数。应按时间递增编排 entries，并给每次转动及装配留足时段。构造完成即执行 `apply(0)`。场景数据先复制为内部配置，后续调用不依赖调用者修改原参数。

## apply(t) 时间线

`t` 为全片秒数，可冷跳转、重复或倒序调用，无独立时钟。

- 偶数条目在 half-a，奇数条目在预转 180° 的 half-b。第 i 条（i > 0）于 `[turnAt, turnAt + turnDur]` 使用 `kit.ease.inOut` 从 `(i-1)*180°` 转到 `i*180°`，随后保持累计角度。
- 面板在本条 turnAt 显示，在后面第二条的 turnAt 隐藏；最后两条保持。半边底色取该半边截至 t 最近进入条目的 color，进入前透明。第 0 条 turnAt 为 null 时按 0 秒处理。
- 非 finish 件按下表与 order 稳定排序；相同排序值保留清单顺序。按排序中首次出现顺序建立组，未指定 group 的件各自成组。组 i 起点为 `ts = buildAt + i*(buildDur-1)/max(1,groups-1)`。
- `t < ts` 隐藏并恢复初始姿态；`[ts, ts+0.65]` 按 out3 到冲击位；`[ts+0.65, ts+0.81]` 按 backOut(2.2) 回静止位；之后保持。两段由 `kit.settle(t, ts, 0.65, 0.16)` 统一计算。
- 冲击主轴优先级为 rotateX、rotateY、y、x：旋转冲击为 -1.5°，位移冲击为初始方向相反的 6px。所有轴最终归零。
- finish 件在 `buildAt + buildDur - 0.15` 直接显示静止位，不占用装配组。

| kind | 排序 | 初始位姿（未列轴为 0） |
| --- | --- | --- |
| floor | 0 | y=300，rotateX=68° |
| sky | 1 | y=-200 |
| backing | 1 | y=24，rotateX=78° |
| wall / panel / alcove | 2 | y=24，rotateX=78° |
| beam / roof / header / frame | 3 | y=-900，按组序号交替旋转 -1.5° / 1.5° |
| hill / lake / ground | 4 | y=200，rotateX=35° |
| lamp / hanging | 7 | y=-max(300,y+h+60)，按组序号交替旋转 -2° / 2° |
| 其他 | 5 | 件中心在面板左半幅则 x=-420，否则 x=420；y=28 |

motion 覆盖：left/right 为 x=-420/+420、y=20；rise 为 y=180；drop 为 y=-max(300,y+h+60)；fold 为 y=24、rotateX=78°。类型由显式 kind 决定，不根据素材 id 推断。finish 也由显式字段指定。

## DOM 与所有权

以下所有类名均带 `hf-kit-disc-scene-` 前缀，CSS 由本积木注入；所有节点均通过 kit.make 创建、kit.abs 定位、kit.shown 控制显隐。

```text
root
└─ disc
   ├─ half-a
   └─ half-b
      └─ scene-plane（每条 entry 一个，分配到相应半边）
         ├─ backdrop（可选 img）
         └─ piece（每件一个，装配外层）
            └─ inner（工程场景内动作）
               └─ image（img）
```

默认 disc 为 4400×4400，半边为 4400×2200；面板固定 1920×1080，left=1240、底边贴圆心。自定义直径时按半径推导面板居中位置，面板尺寸不变。面板使用 perspective:2400px 与 isolation:isolate；piece 隐藏背面。图片均为空 alt、不可拖拽。

外层 transform 固定为 `translate3d(x px, y px, 0) rotateX(rx deg) rotateY(ry deg) rotate(r deg)`。`block.piece(entryIndex, pieceId)` 返回 inner；不存在时抛错。工程可在装配完成后按 t 给 inner 写场景内 transform，积木不覆盖该 transform；工程也须自己保证倒序与重复 seek 的确定性。显隐归积木，隐藏面板的图片及包装均明确隐藏，避免子节点显式 visible 穿透父级 visibility。

`dispose()` 移除 root，可重复调用；之后 apply 不再写 DOM。注入的共享 CSS 保留。

## 镜头表写法

| 镜头 | 舞台动作 | 参数与时刻 |
| --- | --- | --- |
| 地点 A 转地点 B | disc.scene | background 宿主；entries 的 A 为 turnAt:null、buildAt:0.1；B 为 turnAt:6、buildAt:8.2；turnDur:2.2，buildDur:4.2 |

先加载 stage-kit.js，再加载本积木，使用 `HarnessStageKit.create('disc.scene', options)`；由工程主时间线调用 block.apply(t)。布景位图由工程提供，卡片不配送参考布景。像素景四套调色 variants/palettes、本批允许忽略的特殊岛屿动作均未覆盖。

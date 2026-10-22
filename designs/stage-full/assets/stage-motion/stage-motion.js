/* stage-full 卡片动作包：把工具级标准动词换成纸艺舞台的动法（卡内资产，随工程装进 runtime/）
 *
 * 先加载 runtime/motion.js，再加载本文件；工程用 HarnessMotion.create({ card: 'stage-full' })。
 * 参数表由工具定义，这里只换「怎么动」：纸片绕底边铰链立起、折倒，沿弧线移动，在铰链上晃稳。
 * 纸板是硬的：不挤压、不拉伸；重量感来自铰链过冲与衰减晃动。所有实现都是进度 p 的纯函数。
 */
(function (global) {
  "use strict";

  var M = global.HarnessMotion;
  if (!M) throw new Error("stage-motion: load runtime/motion.js first");

  var LIE = 88;          // 平躺角度，与 stage-rig 道具脚一致
  var FOLD_WINDOW = 0.3; // 换场时每件纸片折倒或立起占整段的比例

  function standUp(ctx, local) {
    var back = ctx.ease.back(1.2 * ctx.config.strength);
    return { o: ctx.span(local, 0, 0.18), rx: LIE * (1 - back(local)) };
  }
  function foldDown(ctx, local, base) {
    return { o: base.o * (1 - ctx.span(local, 0.8, 1)), rx: ctx.lerp(base.rx, LIE, ctx.ease.exit(local)) };
  }
  // 铰链上的衰减晃动：先向前冲再回弹，p=1 时精确回到 0。
  function wobble(strength, p) {
    if (p <= 0 || p >= 1) return 0;
    return -9 * strength * Math.exp(-3.5 * p) * Math.sin(3 * Math.PI * p);
  }
  function arc(ctx, base, to, p) {
    var e = ctx.ease.move(p);
    var dx = to.x - base.x, dy = to.y - base.y;
    var height = Math.min(160, 0.35 * Math.sqrt(dx * dx + dy * dy)) * ctx.config.strength;
    var lean = Math.max(-6, Math.min(6, dx / 40)) * ctx.config.strength;
    return {
      x: ctx.lerp(base.x, to.x, e),
      y: ctx.lerp(base.y, to.y, e) - height * Math.sin(Math.PI * e),
      r: base.r + lean * Math.sin(Math.PI * ctx.clamp01(p))
    };
  }

  M.registerCard("stage-full", {
    origin: "50% 100%",
    replace: {
      appear: {
        how: "纸片沿底边铰链从平躺立起，带一点过冲后停稳",
        impl: function (ctx) {
          return { channels: ["o", "rx"], sample: function (p) { return standUp(ctx, p); } };
        }
      },
      exit: {
        how: "纸片沿底边铰链向后折倒，躺平后消失",
        impl: function (ctx) {
          return { channels: ["o", "rx"], sample: function (p, base) { return foldDown(ctx, p, base); } };
        }
      },
      emphasize: {
        how: "纸片被轻轻提起、左右晃一下再放回原位",
        impl: function (ctx) {
          var lift = 14 * ctx.config.strength, tilt = 2.5 * ctx.config.strength;
          return { channels: ["y", "r"], sample: function (p, base) {
            return { y: base.y - lift * Math.sin(Math.PI * p), r: base.r + tilt * Math.sin(2 * Math.PI * p) };
          } };
        }
      },
      moveTo: {
        how: "沿弧线跳到 to，途中朝前进方向微倾",
        impl: function (ctx) {
          return { channels: ["x", "y", "r"], sample: function (p, base) { return arc(ctx, base, ctx.config.to, p); } };
        }
      },
      settle: {
        how: "纸片在铰链上前后晃两下停稳（冲击 + 小回弹）",
        impl: function (ctx) {
          return { channels: ["rx"], sample: function (p, base) { return { rx: base.rx + wobble(ctx.config.strength, p) }; } };
        }
      },
      transition: {
        how: "旧物按列表顺序依次折倒，新物再按顺序立起；整台换地点用背景动作换景",
        fits: "同一舞台上换一批物体；列表按从后排到前排排列",
        impl: function (ctx) {
          var offset = ctx.count > 1 ? 0.15 * ctx.index / (ctx.count - 1) : 0;
          var start = ctx.role === "out" ? offset : 0.55 + offset;
          return { channels: ["o", "rx"], sample: function (p, base) {
            var local = ctx.span(p, start, start + FOLD_WINDOW);
            return ctx.role === "out" ? foldDown(ctx, local, base) : standUp(ctx, local);
          } };
        }
      }
    },
    extra: {
      sortTo: {
        name: "归位", intent: "物体沿弧线落进指定位置并晃稳",
        fits: "分组、归托盘、放进容器", how: "弧线跳到 to，落下后在铰链上晃两下停稳",
        params: { to: "offset!", stagger: "stagger" }, durationDefault: 0.9,
        impl: function (ctx) {
          return { channels: ["x", "y", "r", "rx"], sample: function (p, base) {
            var state = arc(ctx, base, ctx.config.to, ctx.span(p, 0, 0.72));
            state.rx = base.rx + wobble(ctx.config.strength, ctx.span(p, 0.72, 1));
            return state;
          } };
        }
      }
    }
  });
})(window);

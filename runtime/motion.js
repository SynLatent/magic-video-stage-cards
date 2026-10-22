/* HarnessMotion · 工具级标准动作（6 个动词）与卡片替换
 *
 * 工程只调用动词，不写缓动和关键帧：
 *   var motion = HarnessMotion.create({ card: 'stage-full' });   // 省略 card 用工具默认实现
 *   motion.appear(box, { at: 2 });
 *   motion.moveTo(box, { at: 3, to: { x: 240, y: 0 } });
 *   motion.exit([a, b, c], { at: 6, stagger: { span: 0.3 } });
 *   function renderAt(t) { motion.apply(t); }                     // 交给 HarnessScene.bindScene
 *
 * 两级：工具定义动词、参数表和默认实现；卡片经 registerCard 替换部分动词的实现，或增加本卡独有动词。
 * 替换只换「怎么动」，参数表仍由工具定义，卡片不能新增必填参数。motion.menu() 返回合并后的唯一清单。
 *
 * 确定性：apply(t) 是全片秒数 t 的纯函数，没有 RAF、定时器、Date、Math.random，也不读回 DOM 当前值。
 * 每个动作只拥有它声明的通道（x、y、r、rx、s、o）；同一目标的同一通道在重叠时段被两个动作占用时，
 * 在添加时抛 TypeError。动作的起点取同一通道上一个动作的终态，第一个动作取静止姿态。
 * 实例拥有目标的 transform、transform-origin、opacity、visibility；dispose() 恢复原值。
 */
(function (global) {
  "use strict";

  var VERSION = 1;
  var CHANNELS = ["x", "y", "r", "rx", "s", "o"];
  var REST = { x: 0, y: 0, r: 0, rx: 0, s: 1, o: 1 };
  var DURATION = { quick: 0.24, standard: 0.6, scene: 1.2 };
  var STRENGTH = { soft: 0.6, normal: 1, strong: 1.4 };

  function clamp01(p) { return p <= 0 ? 0 : p >= 1 ? 1 : p; }
  function lerp(a, b, p) { return a + (b - a) * p; }
  // 与 GSAP 同名缓动同一公式：enter=power3.out，exit=power3.in，move=power3.inOut。
  var ease = {
    enter: function (p) { p = clamp01(p); return 1 - Math.pow(1 - p, 3); },
    exit: function (p) { p = clamp01(p); return p * p * p; },
    move: function (p) { p = clamp01(p); return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; },
    linear: function (p) { return clamp01(p); },
    // back.out(k)：卡片用于有重量的过冲，工具默认实现不用。
    back: function (k) {
      return function (p) { p = clamp01(p); var q = p - 1; return 1 + (k + 1) * q * q * q + k * q * q; };
    }
  };
  // 子区间进度：p 落在 [a, b] 内的线性进度。
  function span(p, a, b) { return b <= a ? (p >= b ? 1 : 0) : clamp01((p - a) / (b - a)); }

  // ---------- 动词参数表：工具唯一定义，卡片替换不能改 ----------
  var COMMON = { at: "time", duration: "duration", strength: "strength" };
  var KINDS = ["offset", "stagger", "text", "number"];
  var VERBS = {
    appear: {
      name: "出现", intent: "物体进入画面并停稳", fits: "新物体登场；按口播逐个揭示",
      params: { stagger: "stagger" }, durationDefault: "standard",
      how: "淡入并从下方 24 px 平滑升到原位，不回弹"
    },
    exit: {
      name: "退场", intent: "物体离开画面", fits: "讲完的物体让位",
      params: { stagger: "stagger" }, durationDefault: "quick",
      how: "淡出并轻微上移"
    },
    emphasize: {
      name: "强调", intent: "让已在场的物体被注意一下，结束后复原", fits: "口播点到这个物体",
      params: {}, durationDefault: "standard",
      how: "轻微放大后复原"
    },
    moveTo: {
      name: "移动到", intent: "在场物体换到新位置", fits: "归类、排序、靠拢、对比",
      params: { to: "offset!", stagger: "stagger" }, durationDefault: "standard",
      how: "直线平移到 to（相对布局原位的像素偏移）"
    },
    settle: {
      name: "落定", intent: "已到位的物体表现落稳的分量", fits: "放下、盖章、归位后的那一下",
      params: {}, durationDefault: "standard",
      how: "轻压一下后平稳复原，不回弹"
    },
    transition: {
      name: "换场", intent: "一组物体交给另一组物体", fits: "话题切换；同一 Scene 内换一批物体",
      params: {}, durationDefault: "scene", targets: "pair",
      how: "旧组淡出、新组淡入，交叉进行"
    }
  };

  function fail(message) { throw new TypeError("HarnessMotion: " + message); }
  function finite(value, name) {
    var number = Number(value);
    if (typeof value === "boolean" || value === null || value === "" || !Number.isFinite(number)) fail(name + " must be a finite number");
    return number;
  }

  function elements(value, name) {
    var list = value && value.nodeType === 1 ? [value] : Array.prototype.slice.call(value || []);
    if (!list.length) fail(name + " must be an element or a non-empty list of elements");
    list.forEach(function (node) { if (!node || node.nodeType !== 1) fail(name + " must contain only elements"); });
    return list;
  }

  function normalize(verb, schema, config) {
    if (!config || typeof config !== "object") fail(verb + " needs a config object with at");
    var kinds = {};
    Object.keys(COMMON).forEach(function (key) { kinds[key] = COMMON[key]; });
    Object.keys(schema.params).forEach(function (key) { kinds[key] = schema.params[key]; });
    Object.keys(config).forEach(function (key) { if (!kinds[key]) fail(verb + ": unknown option '" + key + "'"); });
    var out = {};
    if (config.at == null) fail(verb + ": option 'at' is required");
    out.at = finite(config.at, verb + ".at");
    if (out.at < 0) fail(verb + ".at must be >= 0");
    var duration = config.duration == null ? schema.durationDefault : config.duration;
    out.duration = typeof duration === "string" ? DURATION[duration] : finite(duration, verb + ".duration");
    if (out.duration == null) fail(verb + ".duration must be one of " + Object.keys(DURATION).join("/") + " or seconds");
    if (out.duration < 0) fail(verb + ".duration must be >= 0");
    var strength = config.strength == null ? "normal" : config.strength;
    out.strength = STRENGTH[strength];
    if (out.strength == null) fail(verb + ".strength must be one of " + Object.keys(STRENGTH).join("/"));
    Object.keys(schema.params).forEach(function (key) {
      var kind = schema.params[key], value = config[key];
      var required = kind.slice(-1) === "!";
      kind = kind.replace("!", "");
      if (value == null) { if (required) fail(verb + ": option '" + key + "' is required"); return; }
      if (kind === "offset") {
        if (typeof value !== "object") fail(verb + "." + key + " must be {x, y}");
        Object.keys(value).forEach(function (axis) { if (axis !== "x" && axis !== "y") fail(verb + "." + key + " only takes x and y"); });
        out[key] = { x: value.x == null ? 0 : finite(value.x, verb + "." + key + ".x"), y: value.y == null ? 0 : finite(value.y, verb + "." + key + ".y") };
      } else if (kind === "stagger") {
        if (typeof value !== "object") fail(verb + ".stagger must be {span, order}");
        Object.keys(value).forEach(function (field) { if (field !== "span" && field !== "order") fail(verb + ".stagger only takes span and order"); });
        var spanValue = value.span == null ? 0 : finite(value.span, verb + ".stagger.span");
        if (spanValue < 0) fail(verb + ".stagger.span must be >= 0");
        // 省略 duration 时每件保持默认时长，错峰另加；显式 duration 是整组总时长。
        if (config.duration == null) out.duration += spanValue;
        if (spanValue > 0 && spanValue >= out.duration) fail(verb + ".stagger.span must be shorter than duration");
        var order = value.order == null ? "forward" : value.order;
        if (order !== "forward" && order !== "reverse") fail(verb + ".stagger.order must be forward or reverse");
        out[key] = { span: spanValue, order: order };
      } else if (kind === "text") {
        if (typeof value !== "string" || !value) fail(verb + "." + key + " must be a non-empty string");
        out[key] = value;
      } else if (kind === "number") {
        out[key] = finite(value, verb + "." + key);
      } else {
        fail(verb + ": unsupported parameter kind '" + kind + "'");
      }
    });
    return out;
  }

  // ---------- 工具默认实现 ----------
  // 实现签名：impl(ctx) -> { channels: [...], sample(p, base) -> { 通道: 值 } }
  // ctx: { config, role, index, count, ease, span, lerp }；base 是本动作开始前各通道的值。
  var TOOL = {
    appear: function (ctx) {
      var rise = 24 * ctx.config.strength;
      return { channels: ["o", "y"], sample: function (p, base) {
        var e = ease.enter(p);
        return { o: e, y: base.y + rise * (1 - e) };
      } };
    },
    exit: function (ctx) {
      var lift = 12 * ctx.config.strength;
      return { channels: ["o", "y"], sample: function (p, base) {
        var e = ease.exit(p);
        return { o: base.o * (1 - e), y: base.y - lift * e };
      } };
    },
    emphasize: function (ctx) {
      var amount = 0.08 * ctx.config.strength;
      return { channels: ["s"], sample: function (p, base) {
        return { s: base.s * (1 + amount * Math.sin(Math.PI * clamp01(p))) };
      } };
    },
    moveTo: function (ctx) {
      var to = ctx.config.to;
      return { channels: ["x", "y"], sample: function (p, base) {
        var e = ease.move(p);
        return { x: lerp(base.x, to.x, e), y: lerp(base.y, to.y, e) };
      } };
    },
    settle: function (ctx) {
      var press = 6 * ctx.config.strength;
      return { channels: ["y", "s"], sample: function (p, base) {
        var bump = Math.sin(Math.PI * clamp01(p));
        return { y: base.y + press * bump, s: base.s * (1 - 0.02 * ctx.config.strength * bump) };
      } };
    },
    transition: function (ctx) {
      var out = ctx.role === "out";
      return { channels: ["o"], sample: function (p, base) {
        var e = ease.move(p);
        return { o: out ? base.o * (1 - e) : e };
      } };
    }
  };

  // ---------- 卡片注册 ----------
  var cards = {};
  function registerCard(id, pack) {
    if (typeof id !== "string" || !/^[a-z0-9-]+$/.test(id)) fail("card id must be lowercase letters, digits or '-'");
    if (cards[id]) fail("card already registered: " + id);
    if (!pack || typeof pack !== "object") fail("card pack must be an object");
    Object.keys(pack).forEach(function (key) {
      if (["origin", "replace", "extra"].indexOf(key) < 0) fail(id + ": unknown pack field '" + key + "'");
    });
    var replace = pack.replace || {}, extra = pack.extra || {};
    Object.keys(replace).forEach(function (verb) {
      if (!VERBS[verb]) fail(id + ": replace." + verb + " is not a standard verb");
      var entry = replace[verb];
      if (!entry || typeof entry.impl !== "function" || typeof entry.how !== "string" || !entry.how) fail(id + ": replace." + verb + " needs impl() and how");
      Object.keys(entry).forEach(function (key) {
        if (["impl", "how", "fits"].indexOf(key) < 0) fail(id + ": replace." + verb + " cannot set '" + key + "'; the tool owns the parameters");
      });
    });
    Object.keys(extra).forEach(function (verb) {
      if (VERBS[verb] || !/^[a-z][A-Za-z]+$/.test(verb)) fail(id + ": extra verb '" + verb + "' must be a new camelCase name");
      var entry = extra[verb];
      if (!entry || typeof entry.impl !== "function") fail(id + ": extra." + verb + " needs impl()");
      ["name", "intent", "fits", "how"].forEach(function (key) {
        if (typeof entry[key] !== "string" || !entry[key]) fail(id + ": extra." + verb + "." + key + " is required");
      });
      if (!DURATION[entry.durationDefault] && !(Number(entry.durationDefault) >= 0)) fail(id + ": extra." + verb + ".durationDefault is required");
      Object.keys(entry.params || {}).forEach(function (key) {
        if (COMMON[key]) fail(id + ": extra." + verb + " cannot redefine '" + key + "'");
        if (KINDS.indexOf(String(entry.params[key]).replace("!", "")) < 0) fail(id + ": extra." + verb + "." + key + " has an unsupported kind");
      });
    });
    cards[id] = { origin: pack.origin || "50% 50%", replace: replace, extra: extra };
  }

  function catalogue(cardId) {
    var card = cardId == null ? null : cards[cardId];
    if (cardId != null && !card) fail("unknown card '" + cardId + "'; registered: " + Object.keys(cards).sort().join(", "));
    var entries = {};
    Object.keys(VERBS).forEach(function (verb) {
      var schema = VERBS[verb], swap = card && card.replace[verb];
      entries[verb] = { schema: schema, impl: swap ? swap.impl : TOOL[verb], source: swap ? "card" : "tool",
        how: swap ? swap.how : schema.how, fits: swap && swap.fits ? swap.fits : schema.fits };
    });
    if (card) Object.keys(card.extra).forEach(function (verb) {
      var entry = card.extra[verb];
      entries[verb] = { schema: { name: entry.name, intent: entry.intent, params: entry.params || {}, durationDefault: entry.durationDefault },
        impl: entry.impl, source: "card-only", how: entry.how, fits: entry.fits };
    });
    return { card: card, entries: entries };
  }

  function describe(entry, verb) {
    var schema = entry.schema, required = ["at"], optional = ["duration", "strength"];
    Object.keys(schema.params).forEach(function (key) {
      (schema.params[key].slice(-1) === "!" ? required : optional).push(key);
    });
    return { verb: verb, name: schema.name, intent: schema.intent, fits: entry.fits, how: entry.how,
      source: entry.source, targets: schema.targets === "pair" ? "{outgoing, incoming}" : "element(s)",
      required: required, optional: optional,
      duration: typeof schema.durationDefault === "string" ? schema.durationDefault + " " + DURATION[schema.durationDefault] + "s" : schema.durationDefault + "s" };
  }

  function menu(cardId) {
    var cat = catalogue(cardId);
    return Object.keys(cat.entries).map(function (verb) { return describe(cat.entries[verb], verb); });
  }

  // ---------- 实例 ----------
  function create(options) {
    options = options || {};
    Object.keys(options).forEach(function (key) { if (key !== "card") fail("create: unknown option '" + key + "'"); });
    var cardId = options.card == null ? null : options.card;
    var cat = catalogue(cardId);
    var origin = cat.card ? cat.card.origin : "50% 50%";
    var targets = [];      // { node, saved, bindings: [], tracks: { 通道: [binding] } }
    var dirty = true;
    var disposed = false;
    var rhythm = [];
    var rhythmSource = function () { return rhythm; };
    (global.__hfRhythmSources = global.__hfRhythmSources || new Set()).add(rhythmSource);

    function find(node) {
      for (var i = 0; i < targets.length; i += 1) if (targets[i].node === node) return targets[i];
      return null;
    }
    function conflict(tracks, binding) {
      binding.channels.forEach(function (channel) {
        (tracks[channel] || []).forEach(function (other) {
          if (binding.start === other.start || (binding.start < other.end && other.start < binding.end)) {
            fail(binding.verb + " at " + binding.start + "s and " + other.verb + " at " + other.start +
              "s both drive '" + channel + "' of the same element; separate them in time");
          }
        });
      });
    }
    function claim(tracks, binding) {
      binding.channels.forEach(function (channel) { (tracks[channel] = tracks[channel] || []).push(binding); });
    }

    function add(verb, subjects, config) {
      if (disposed) fail("instance is disposed");
      var entry = cat.entries[verb];
      if (!entry) fail("unknown verb '" + verb + "'; available: " + Object.keys(cat.entries).join(", "));
      var schema = entry.schema;
      var normalized = normalize(verb, schema, config);
      var groups;
      if (schema.targets === "pair") {
        if (!subjects || typeof subjects !== "object" || subjects.nodeType) fail(verb + " targets must be {outgoing, incoming}");
        Object.keys(subjects).forEach(function (key) { if (key !== "outgoing" && key !== "incoming") fail(verb + " targets only take outgoing and incoming"); });
        var outgoing = elements(subjects.outgoing, verb + ".outgoing"), incoming = elements(subjects.incoming, verb + ".incoming");
        outgoing.forEach(function (node) { if (incoming.indexOf(node) >= 0) fail(verb + ": an element cannot be both outgoing and incoming"); });
        groups = [{ role: "out", list: outgoing }, { role: "in", list: incoming }];
      } else {
        groups = [{ role: null, list: elements(subjects, verb + " targets") }];
      }
      var pending = [];
      groups.forEach(function (group) {
        var count = group.list.length, stagger = normalized.stagger || { span: 0, order: "forward" };
        var each = count > 1 ? normalized.duration - stagger.span : normalized.duration;
        group.list.forEach(function (node, i) {
          if (pending.some(function (item) { return item.node === node; })) fail(verb + ": the same element is listed twice");
          var rank = stagger.order === "reverse" ? count - 1 - i : i;
          var offset = count > 1 ? rank * stagger.span / (count - 1) : 0;
          var spec = entry.impl({ config: normalized, role: group.role, index: i, count: count,
            ease: ease, span: span, lerp: lerp, clamp01: clamp01 });
          if (!spec || typeof spec.sample !== "function" || !Array.isArray(spec.channels) || !spec.channels.length) fail(verb + " implementation must return {channels, sample}");
          spec.channels.forEach(function (channel) { if (CHANNELS.indexOf(channel) < 0) fail(verb + " implementation uses unknown channel '" + channel + "'"); });
          pending.push({ node: node, binding: { verb: verb, channels: spec.channels.slice(), sample: spec.sample,
            start: normalized.at + offset, end: normalized.at + offset + each, duration: each, base: null } });
        });
      });
      // 先全部校验，再写入：失败的调用不留下半个动作。
      pending.forEach(function (item) {
        var existing = find(item.node);
        conflict(existing ? existing.tracks : {}, item.binding);
      });
      pending.forEach(function (item) {
        var target = find(item.node);
        if (!target) {
          var node = item.node;
          target = { node: node, bindings: [], tracks: {}, saved: {
            transform: node.style.transform, transformOrigin: node.style.transformOrigin,
            opacity: node.style.opacity, visibility: node.style.visibility } };
          node.style.transformOrigin = origin;
          targets.push(target);
        }
        claim(target.tracks, item.binding);
        target.bindings.push(item.binding);
        rhythm.push({ target: item.node, time: item.binding.start, duration: item.binding.duration, kind: "motion_" + verb });
      });
      dirty = true;
      return instance;
    }

    function sample(binding, p) {
      var state = binding.sample(p, binding.base);
      var out = {};
      binding.channels.forEach(function (channel) {
        if (!Number.isFinite(state[channel])) fail(binding.verb + " produced a non-finite '" + channel + "'");
        out[channel] = state[channel];
      });
      return out;
    }

    // 每个目标按起点顺序求各动作的 base：所拥有通道取该通道上一个动作的终态，第一个取静止姿态；
    // 不拥有的通道也按当时的值给出，供实现读取（如弧线高度依赖水平距离）。
    function prepare() {
      targets.forEach(function (target) {
        var current = {};
        CHANNELS.forEach(function (channel) { current[channel] = REST[channel]; });
        target.bindings.slice().sort(function (a, b) { return a.start - b.start; }).forEach(function (binding) {
          binding.base = {};
          CHANNELS.forEach(function (channel) { binding.base[channel] = current[channel]; });
          var end = sample(binding, 1);
          Object.keys(end).forEach(function (channel) { current[channel] = end[channel]; });
        });
        CHANNELS.forEach(function (channel) {
          if (target.tracks[channel]) target.tracks[channel].sort(function (a, b) { return a.start - b.start; });
        });
      });
      dirty = false;
    }

    function apply(t) {
      if (disposed) return;
      t = Number(t);
      if (!Number.isFinite(t)) fail("apply(t) needs a finite time");
      if (dirty) prepare();
      targets.forEach(function (target) {
        var state = {};
        CHANNELS.forEach(function (channel) {
          var list = target.tracks[channel];
          if (!list) { state[channel] = REST[channel]; return; }
          var active = list[0];
          for (var i = 1; i < list.length; i += 1) if (list[i].start <= t) active = list[i];
          var p = active.duration === 0 ? (t >= active.start ? 1 : 0) : clamp01((t - active.start) / active.duration);
          state[channel] = sample(active, p)[channel];
        });
        var transform = "translate(" + state.x.toFixed(2) + "px, " + state.y.toFixed(2) + "px)";
        if (state.rx) transform = "perspective(1400px) " + transform + " rotateX(" + state.rx.toFixed(3) + "deg)";
        if (state.r) transform += " rotate(" + state.r.toFixed(3) + "deg)";
        if (state.s !== 1) transform += " scale(" + state.s.toFixed(4) + ")";
        var o = clamp01(state.o);
        target.node.style.transform = transform;
        target.node.style.opacity = o.toFixed(3);
        target.node.style.visibility = o <= 0.001 ? "hidden" : "visible";
      });
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      if (global.__hfRhythmSources) global.__hfRhythmSources.delete(rhythmSource);
      targets.forEach(function (target) {
        Object.keys(target.saved).forEach(function (key) { target.node.style[key] = target.saved[key]; });
      });
      targets.length = 0;
    }

    var instance = {
      card: cardId,
      add: add,
      apply: apply,
      dispose: dispose,
      menu: function () { return menu(cardId); }
    };
    Object.keys(cat.entries).forEach(function (verb) {
      instance[verb] = function (subjects, config) { return add(verb, subjects, config); };
    });
    return instance;
  }

  global.HarnessMotion = {
    VERSION: VERSION,
    tokens: { duration: DURATION, strength: STRENGTH },
    ease: ease,
    verbs: Object.keys(VERBS),
    registerCard: registerCard,
    cards: function () { return Object.keys(cards).sort(); },
    menu: menu,
    create: create
  };
})(window);

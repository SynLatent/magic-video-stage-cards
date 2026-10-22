(function (global) {
  "use strict";
  if (!global.HarnessStageKit) throw new Error('stage-kit core must load before blocks/slot-text.js');

  var CSS_TEXT = '.hf-kit-slot-text-root{box-sizing:border-box;font-family:inherit;pointer-events:none;}' +
    '.hf-kit-slot-text-card{box-sizing:border-box;font-family:inherit;border-radius:14px;padding:18px 24px;box-shadow:0 4px 12px rgba(32,28,24,.12);line-height:1.4;overflow:hidden;}';

  global.HarnessStageKit.define('slot.text', function (options, kit) {
    var mount = kit.requireNode(options.mount, 'slot.text', 'text');
    var box = kit.requireBox(options.box, null, 'slot.text');
    var slots = kit.requireBox(options, ['slots'], 'slot.text').slots;
    var gap = options.gap === undefined ? 18 : kit.requireBox(options, ['gap'], 'slot.text').gap;
    var style = options.style || {};
    var size = style.size === undefined ? 40 : kit.requireBox(style, ['size'], 'slot.text.style').size;
    var entries = [];
    var dims = [];
    var root;
    var disposed = false;
    var height;

    function invalid(message) { throw new TypeError('stage-kit.slot.text: ' + message); }
    if (slots !== Math.floor(slots) || slots < 1 || slots > 4) invalid('slots must be an integer from 1 to 4');
    if (box.w <= 0 || box.h <= 0 || gap < 0 || size <= 0) invalid('invalid box, gap or size');
    height = (box.h - gap * (slots - 1)) / slots;
    if (height <= 0) invalid('gap leaves no slot height');
    if (!Array.isArray(options.entries)) invalid('entries must be an array');
    if (!Array.isArray(options.dim)) invalid('dim must be an array');

    options.entries.forEach(function (entry) {
      var values = kit.requireBox(entry, ['slot', 'at'], 'slot.text.entry');
      var hold = entry.hold === undefined ? 1.5 : kit.requireBox(entry, ['hold'], 'slot.text.entry').hold;
      var out = entry.out === undefined ? null : kit.requireBox(entry, ['out'], 'slot.text.entry').out;
      var outDur = entry.outDur === undefined ? 0.35 : kit.requireBox(entry, ['outDur'], 'slot.text.entry').outDur;
      if (typeof entry.id !== 'string' || !entry.id) invalid('entry id must be a nonempty string');
      if (typeof entry.html !== 'string') invalid('entry html must be a string');
      if (values.slot !== Math.floor(values.slot) || values.slot < 0 || values.slot >= slots) invalid('entry slot is outside slots');
      if (hold < 1.5 || outDur <= 0) invalid('hold must be at least 1.5 and outDur must be positive');
      if (out !== null && out < values.at + 0.45 + hold) invalid('out violates reading hold');
      entries.forEach(function (other) {
        if (other.id === entry.id) invalid('entry ids must be unique');
        if (other.slot === values.slot && values.at < other.end && other.at < (out === null ? Infinity : out + outDur)) {
          invalid('entries overlap in the same slot');
        }
      });
      entries.push({ id: entry.id, html: entry.html, slot: values.slot, at: values.at,
        out: out, outDur: outDur, end: out === null ? Infinity : out + outDur });
    });
    options.dim.forEach(function (interval) {
      var value = kit.requireBox(interval, ['from', 'to'], 'slot.text.dim');
      if (value.to <= value.from) invalid('dim.to must exceed dim.from');
      dims.push(value);
    });
    dims.sort(function (a, b) { return a.from - b.from; });
    // 连续接管区间合并，避免接管期间因切换区间而改变冻结画面。
    dims = dims.reduce(function (result, interval) {
      var last = result[result.length - 1];
      if (last && interval.from <= last.to) last.to = Math.max(last.to, interval.to);
      else result.push({ from: interval.from, to: interval.to });
      return result;
    }, []);

    // B 接管区间内不得安排 A 条目退场：返回 A 时必须恢复 B 开始时的画面（已读内容直接就位）。
    entries.forEach(function (entry) {
      if (entry.out === null) return;
      dims.forEach(function (interval) {
        if (entry.out < interval.to && entry.out + entry.outDur > interval.from) invalid('entry ' + entry.id + ' exits inside a dim interval');
      });
    });
    kit.ensureCss('hf-kit-slot-text', CSS_TEXT);
    root = kit.abs(kit.make('div', 'hf-kit-slot-text-root', mount), box);
    entries.forEach(function (entry) {
      entry.node = kit.abs(kit.make('div', 'hf-kit-slot-text-card', root), {
        x: 0, y: entry.slot * (height + gap), w: box.w, h: height
      });
      entry.node.setAttribute('data-info-id', entry.id);
      entry.node.innerHTML = entry.html;
      entry.node.style.color = style.ink === undefined ? '#292620' : style.ink;
      entry.node.style.backgroundColor = style.paper === undefined ? '#fffaf0' : style.paper;
      entry.node.style.fontSize = size + 'px';
    });

    function apply(t) {
      var time;
      var dimmed = false;
      if (disposed) return;
      time = kit.finite(t, 'slot.text.t');
      dims.forEach(function (interval) {
        if (time >= interval.from && time < interval.to) {
          dimmed = true;
          time = interval.from;
        }
      });
      kit.shown(root, dimmed ? 0.28 : 1);
      entries.forEach(function (entry) {
        var enter = kit.ease.out3(kit.ramp(time, entry.at, entry.at + 0.45));
        var exit = entry.out === null ? 0 : kit.ease.out3(kit.ramp(time, entry.out, entry.out + entry.outDur));
        entry.node.style.transform = 'translateY(' + (14 * (1 - enter) - 10 * exit) + 'px)';
        kit.shown(entry.node, enter * (1 - exit));
      });
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      if (root.parentNode) root.parentNode.removeChild(root);
    }
    apply(0);
    return { root: root, apply: apply, dispose: dispose };
  });
})(window);

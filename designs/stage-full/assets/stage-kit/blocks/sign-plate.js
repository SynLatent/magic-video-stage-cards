(function (global) {
  "use strict";
  if (!global.HarnessStageKit) throw new Error('stage-kit core must load before blocks/sign-plate.js');

  var CSS_TEXT = [
    '.hf-kit-sign-plate-foot{transform-origin:50% 0;transform-style:preserve-3d;pointer-events:none;font-family:inherit;}',
    '.hf-kit-sign-plate-paper{box-sizing:border-box;border-radius:18px;box-shadow:inset 0 0 0 6px rgba(255,255,255,.9),8px 10px 0 rgba(45,28,12,.2);font-family:inherit;}',
    '.hf-kit-sign-plate-paper::after{content:"";position:absolute;left:calc(50% - 7px);top:100%;width:14px;height:35%;background:inherit;}',
    '.hf-kit-sign-plate-text{font-family:inherit;white-space:nowrap;line-height:1.2;}',
    '.hf-kit-sign-plate-char{font-family:inherit;text-align:center;white-space:pre;}'
  ].join('');

  global.HarnessStageKit.define('sign.plate', function (options, kit) {
    var mount = kit.requireNode(options.mount, 'sign.plate', 'stage');
    var box = kit.requireBox(options.box, null, 'sign.plate.box');
    var at = kit.requireBox(options, ['at'], 'sign.plate').at;
    var dur = options.dur === undefined ? 0.45 : kit.requireBox(options, ['dur'], 'sign.plate').dur;
    var write = options.write === undefined ? null : kit.requireBox(options.write, ['at', 'dur'], 'sign.plate.write');
    var out = options.out === undefined ? null : kit.requireBox(options.out, ['at'], 'sign.plate.out');
    var style = options.style || {};
    var size = style.size === undefined ? 34 : kit.requireBox(style, ['size'], 'sign.plate.style').size;
    var chars;
    var disposed = false;
    if (out) out.dur = options.out.dur === undefined ? dur : kit.requireBox(options.out, ['dur'], 'sign.plate.out').dur;
    if (typeof options.text !== 'string') throw new TypeError('sign.plate: text must be a string');
    // ES5 syntax: count a surrogate pair as one character, including supplementary Han characters.
    chars = options.text.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\s\S]/g) || [];
    if (chars.length < 1 || chars.length > 12) throw new TypeError('sign.plate: text must contain 1 to 12 characters');
    if (box.w <= 0 || box.h <= 0 || size <= 0 || dur <= 0 || (write && write.dur <= 0) || (out && out.dur <= 0)) {
      throw new TypeError('sign.plate: sizes and durations must be positive');
    }

    kit.ensureCss('hf-kit-sign-plate', CSS_TEXT);
    var foot = kit.abs(kit.make('div', 'hf-kit-sign-plate-foot', mount), box);
    foot.setAttribute('data-hf-kit-foot', '');
    var plate = kit.abs(kit.make('div', 'hf-kit-sign-plate-paper', foot), { x: 0, y: 0, w: box.w, h: box.h });
    plate.style.backgroundColor = style.paper === undefined ? '#fdf3dd' : style.paper;
    plate.style.color = style.ink === undefined ? '#2a2018' : style.ink;
    plate.style.fontSize = size + 'px';
    var line = kit.abs(kit.make('div', 'hf-kit-sign-plate-text', plate), {
      x: (box.w - chars.length * size) / 2, y: (box.h - size * 1.2) / 2, w: chars.length * size, h: size * 1.2
    });
    var letters = chars.map(function (character, index) {
      var node = kit.abs(kit.make('span', 'hf-kit-sign-plate-char', line), { x: index * size, y: 0, w: size, h: size * 1.2 });
      node.textContent = character;
      return node;
    });

    function enteringAngle(t) {
      var state = kit.settle(t, at, dur, 0.16);
      if (state.phase === 0) return 88;
      if (state.phase === 1) return kit.lerp(88, -1.5, state.p);
      if (state.phase === 2) return kit.lerp(-1.5, 0, state.p);
      return 0;
    }
    function apply(t) {
      if (disposed) return;
      t = kit.finite(t, 'sign.plate.t');
      var angle = enteringAngle(t);
      if (out && t >= out.at) angle = kit.lerp(enteringAngle(out.at), 88, kit.ease.out3(kit.ramp(t, out.at, out.at + out.dur)));
      var visible = t >= at && (!out || t < out.at + out.dur) ? 1 : 0;
      var count = write ? Math.floor(kit.ramp(t, write.at, write.at + write.dur) * chars.length) : chars.length;
      foot.style.transform = 'rotateX(' + angle + 'deg)';
      kit.shown(foot, visible);
      kit.shown(plate, visible);
      kit.shown(line, visible);
      letters.forEach(function (node, index) { kit.shown(node, visible && index < count ? 1 : 0); });
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      if (foot.parentNode) foot.parentNode.removeChild(foot);
    }
    apply(0);
    return { root: foot, apply: apply, dispose: dispose };
  });
})(window);

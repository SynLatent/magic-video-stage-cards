(function (global) {
  "use strict";
  if (!global.HarnessStageKit) throw new Error('stage-kit core must load before blocks/spot-sweep.js');

  var CSS_TEXT = '.hf-kit-spot-sweep-light{border-radius:50%;transform-origin:50% 50%;pointer-events:none;background:radial-gradient(circle,rgba(255,236,196,.42) 0%,rgba(255,236,196,.16) 42%,rgba(255,236,196,0) 66%);}';

  global.HarnessStageKit.define('spot.sweep', function (options, kit) {
    var mount = kit.requireNode(options.mount, 'spot.sweep', 'overlay');
    var size = kit.requireBox(options, ['size'], 'spot.sweep').size;
    var fadeDur = options.fadeIn === undefined ? 0.5 : kit.requireBox(options.fadeIn, ['dur'], 'spot.sweep.fadeIn').dur;
    var keys = [];
    var pulses = [];
    var out = null;
    var disposed = false;

    function invalid(message) { throw new TypeError('stage-kit.spot.sweep: ' + message); }
    function optional(value, key, fallback, name) {
      return value[key] === undefined ? fallback : kit.requireBox(value, [key], name)[key];
    }
    if (size <= 0 || fadeDur <= 0) invalid('size and fadeIn.dur must be positive');
    if (!Array.isArray(options.keys) || options.keys.length < 2) invalid('keys requires at least two keyframes');
    options.keys.forEach(function (key) {
      var value = kit.requireBox(key, ['at', 'x', 'y'], 'spot.sweep.key');
      value.scale = optional(key, 'scale', 1, 'spot.sweep.key');
      value.opacity = optional(key, 'opacity', 0.9, 'spot.sweep.key');
      if (value.scale <= 0 || value.opacity < 0 || value.opacity > 1) invalid('key scale must be positive and opacity must be in [0,1]');
      if (keys.length && value.at <= keys[keys.length - 1].at) invalid('key at values must be strictly increasing');
      keys.push(value);
    });
    if (options.pulses !== undefined && !Array.isArray(options.pulses)) invalid('pulses must be an array');
    (options.pulses || []).forEach(function (pulse) {
      var value = kit.requireBox(pulse, ['at'], 'spot.sweep.pulse');
      value.dur = optional(pulse, 'dur', 0.24, 'spot.sweep.pulse');
      value.scale = optional(pulse, 'scale', 1.07, 'spot.sweep.pulse');
      if (value.dur <= 0 || value.scale <= 0) invalid('pulse dur and scale must be positive');
      pulses.push(value);
    });
    if (options.out !== undefined) {
      out = kit.requireBox(options.out, ['at'], 'spot.sweep.out');
      out.dur = optional(options.out, 'dur', 0.4, 'spot.sweep.out');
      if (out.dur <= 0) invalid('out.dur must be positive');
    }

    kit.ensureCss('hf-kit-spot-sweep', CSS_TEXT);
    var root = kit.abs(kit.make('div', 'hf-kit-spot-sweep-light', mount), { w: size, h: size });
    root.setAttribute('aria-hidden', 'true');

    function apply(t) {
      if (disposed) return;
      t = kit.finite(t, 'spot.sweep.t');
      var first = keys[0];
      var state = keys[keys.length - 1];
      var x = state.x;
      var y = state.y;
      var scale = state.scale;
      var opacity = state.opacity;
      var p;
      var i;
      if (t < first.at) {
        p = kit.ease.out3(kit.ramp(t, first.at - fadeDur, first.at));
        x = first.x;
        y = first.y;
        scale = kit.lerp(0.9, first.scale, p);
        opacity = first.opacity * p;
      } else {
        for (i = 1; i < keys.length; i += 1) {
          if (t <= keys[i].at) {
            var a = keys[i - 1];
            var b = keys[i];
            p = kit.ease.sineInOut(kit.ramp(t, a.at, b.at));
            x = kit.lerp(a.x, b.x, p);
            y = kit.lerp(a.y, b.y, p);
            scale = kit.lerp(a.scale, b.scale, p);
            opacity = kit.lerp(a.opacity, b.opacity, p);
            break;
          }
        }
      }
      pulses.forEach(function (pulse) {
        var phase = kit.ramp(t, pulse.at, pulse.at + pulse.dur);
        var strength = kit.ease.inOut(phase < 0.5 ? phase * 2 : (1 - phase) * 2);
        scale *= kit.lerp(1, pulse.scale, strength);
      });
      if (out !== null) {
        p = kit.ease.out3(kit.ramp(t, out.at, out.at + out.dur));
        scale = kit.lerp(scale, 0.92, p);
        opacity *= 1 - p;
      }
      root.style.left = (x - size / 2) + 'px';
      root.style.top = (y - size / 2) + 'px';
      root.style.transform = 'scale(' + scale + ')';
      kit.shown(root, opacity);
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

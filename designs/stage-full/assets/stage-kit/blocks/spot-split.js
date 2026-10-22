(function (global) {
  "use strict";
  if (!global.HarnessStageKit) throw new Error('stage-kit core must load before blocks/spot-split.js');

  var CSS_TEXT = '.hf-kit-spot-split-root{pointer-events:none;}' +
    '.hf-kit-spot-split-light{border-radius:50%;transform-origin:50% 50%;pointer-events:none;background:radial-gradient(circle,rgba(255,236,196,.42) 0%,rgba(255,236,196,.16) 42%,rgba(255,236,196,0) 66%);}';

  global.HarnessStageKit.define('spot.split', function (options, kit) {
    var mount = kit.requireNode(options.mount, 'spot.split', 'overlay');
    var values = kit.requireBox(options, ['size', 'at'], 'spot.split');
    var dur = options.dur === undefined ? 0.55 : kit.requireBox(options, ['dur'], 'spot.split').dur;
    var opacity = options.opacity === undefined ? 0.82 : kit.requireBox(options, ['opacity'], 'spot.split').opacity;
    var out = options.out === undefined ? null : kit.requireBox(options.out, ['at', 'dur'], 'spot.split.out');
    var disposed = false;

    function point(value, name) {
      var result = kit.requireBox(value, ['x', 'y'], name);
      result.scale = value.scale === undefined ? 1 : kit.requireBox(value, ['scale'], name).scale;
      if (result.scale <= 0) throw new TypeError(name + ': scale must be positive');
      return result;
    }
    var from = point(options.from, 'spot.split.from');
    if (!Array.isArray(options.to) || options.to.length !== 2) throw new TypeError('spot.split: to requires exactly two points');
    var to = [point(options.to[0], 'spot.split.to[0]'), point(options.to[1], 'spot.split.to[1]')];
    if (values.size <= 0 || dur <= 0 || (out !== null && out.dur <= 0)) {
      throw new TypeError('spot.split: size and durations must be positive');
    }
    if (opacity < 0 || opacity > 1) throw new TypeError('spot.split: opacity must be between 0 and 1');

    kit.ensureCss('hf-kit-spot-split', CSS_TEXT);
    var root = kit.abs(kit.make('div', 'hf-kit-spot-split-root', mount), { x: 0, y: 0 });
    var lights = to.map(function () {
      return kit.abs(kit.make('div', 'hf-kit-spot-split-light', root), { w: values.size, h: values.size });
    });

    function apply(t) {
      if (disposed) return;
      t = kit.finite(t, 'spot.split.t');
      var p = kit.ease.sineInOut(kit.ramp(t, values.at, values.at + dur));
      var exit = out === null ? 0 : kit.ease.sineInOut(kit.ramp(t, out.at, out.at + out.dur));
      kit.shown(root, 1);
      lights.forEach(function (node, i) {
        node.style.left = (kit.lerp(from.x, to[i].x, p) - values.size / 2) + 'px';
        node.style.top = (kit.lerp(from.y, to[i].y, p) - values.size / 2) + 'px';
        node.style.transform = 'scale(' + (kit.lerp(from.scale, to[i].scale, p) * kit.lerp(1, 0.92, exit)) + ')';
        kit.shown(node, opacity * (i === 0 ? 1 : p) * (1 - exit));
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

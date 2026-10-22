/* stack.explode · 第 2 层叠层剖切 */
(function (global) {
  "use strict";

  if (!global.HarnessStageKit) throw new Error('stage-kit core must load before blocks/stack-explode.js');

  var CSS_TEXT = [
    '.hf-kit-stack-explode-root{pointer-events:none;overflow:visible;}',
    '.hf-kit-stack-explode-stack{transform-style:preserve-3d;transform-origin:0 0;overflow:visible;}',
    '.hf-kit-stack-explode-plate{box-sizing:border-box;background:#f4eddf;border:3px solid #fff;border-radius:6px;box-shadow:5px 7px 0 rgba(44,37,29,.22);transform-style:preserve-3d;overflow:visible;}',
    '.hf-kit-stack-explode-label{box-sizing:border-box;color:#302a24;background:#fffaf0;border:1px solid #d8cebd;border-radius:4px;padding:5px 9px;font:inherit;font-size:16px;line-height:22px;white-space:normal;overflow-wrap:break-word;}'
  ].join('\n');

  global.HarnessStageKit.define('stack.explode', function (options, kit) {
    var name = 'stack.explode';
    var mount = kit.requireNode(options.mount, name, 'stage');
    var origin = kit.requireBox(options.origin, ['x', 'y'], name + '.origin');
    var tilt = kit.requireBox(options.tilt, ['x', 'z'], name + '.tilt');
    var gap = kit.requireBox(options, ['gap'], name).gap;
    var explode = kit.requireBox(options.explode, ['at', 'dur'], name + '.explode');
    var collapse = options.collapse == null ? null : kit.requireBox(options.collapse, ['at', 'dur'], name + '.collapse');
    var perspective = options.perspective == null ? 1800 : kit.finite(options.perspective, name + '.perspective');
    var layers;
    var focus;
    var root;
    var stack;
    var plates = [];
    var labels = [];
    var disposed = false;

    if (gap < 0 || perspective <= 0 || explode.dur <= 0 || (collapse && collapse.dur <= 0)) {
      throw new TypeError('stack.explode: gap must be nonnegative; perspective and durations must be positive');
    }
    if (!Array.isArray(options.layers) || options.layers.length < 2 || options.layers.length > 6) {
      throw new TypeError('stack.explode: layers must contain 2–6 layers');
    }
    layers = options.layers.map(function (layer, index) {
      var box = kit.requireBox(layer, ['w', 'h'], name + '.layers[' + index + ']');
      if (box.w <= 0 || box.h <= 0 || typeof layer.id !== 'string' || !layer.id || typeof layer.name !== 'string' || !layer.name || (layer.note != null && typeof layer.note !== 'string')) {
        throw new TypeError('stack.explode: each layer requires positive w/h, nonempty id/name and an optional string note');
      }
      return { id: layer.id, name: layer.name, note: layer.note || '', w: box.w, h: box.h };
    });
    if (options.focus != null && !Array.isArray(options.focus)) throw new TypeError('stack.explode: focus must be an array');
    focus = (options.focus || []).map(function (entry) {
      var value = kit.requireBox(entry, ['index', 'from', 'to'], name + '.focus');
      if (value.index % 1 !== 0 || value.index < 0 || value.index >= layers.length || value.to <= value.from) {
        throw new TypeError('stack.explode: focus requires a valid layer index and to > from');
      }
      return value;
    });

    kit.ensureCss('hf-kit-stack-explode', CSS_TEXT);
    root = kit.make('div', 'hf-kit-stack-explode-root', mount);
    kit.abs(root, { x: origin.x, y: origin.y, w: 0, h: 0 });
    stack = kit.make('div', 'hf-kit-stack-explode-stack', root);
    kit.abs(stack, { x: 0, y: 0, w: 0, h: 0 });
    layers.forEach(function (layer) {
      var plate = kit.make('div', 'hf-kit-stack-explode-plate', stack);
      var label = kit.make('div', 'hf-kit-stack-explode-label', plate);
      kit.abs(plate, { x: -layer.w / 2, y: -layer.h / 2, w: layer.w, h: layer.h });
      kit.abs(label, { x: 0, y: layer.h + 8, w: layer.w });
      plate.setAttribute('data-layer-id', layer.id);
      label.textContent = layer.name + (layer.note ? ' · ' + layer.note : '');
      plates.push(plate);
      labels.push(label);
    });

    function apply(t) {
      var p;
      var active = [];
      var hasFocus = false;
      if (disposed) return;
      t = kit.finite(t, name + '.t');
      p = kit.ease.inOut3(kit.ramp(t, explode.at, explode.at + explode.dur));
      if (collapse) p *= 1 - kit.ease.inOut3(kit.ramp(t, collapse.at, collapse.at + collapse.dur));
      focus.forEach(function (entry) {
        if (t >= entry.from && t < entry.to) {
          active[entry.index] = true;
          hasFocus = true;
        }
      });
      kit.shown(root, 1);
      kit.shown(stack, 1);
      stack.style.transform = 'perspective(' + perspective + 'px) rotateX(' + tilt.x + 'deg) rotateZ(' + tilt.z + 'deg)';
      plates.forEach(function (plate, index) {
        var selected = !!active[index];
        plate.style.transform = 'translateZ(' + (index * gap * p) + 'px)';
        plate.style.borderColor = selected ? '#e4ad48' : '#ffffff';
        plate.style.boxShadow = selected ? '0 0 20px rgba(228,173,72,.65),5px 7px 0 rgba(44,37,29,.22)' : '5px 7px 0 rgba(44,37,29,.22)';
        plate.style.backgroundColor = hasFocus && !selected ? '#d7d0c4' : '#f4eddf';
        labels[index].style.fontWeight = selected ? '700' : '400';
        labels[index].style.color = hasFocus && !selected ? '#756d63' : '#302a24';
        kit.shown(plate, 1);
        kit.shown(labels[index], 1);
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

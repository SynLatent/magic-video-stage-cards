/* 折叠重建换地点：铰链归 rig，位移与缩放归 wrapper。 */
(function (global) {
  "use strict";
  if (!global.HarnessStageKit) throw new Error('stage-kit core must load before blocks/rig-rebuild.js');

  global.HarnessStageKit.define('rig.rebuild', function (options, kit) {
    var name = 'rig.rebuild';
    var rig = options.rig;
    var wrapper = kit.requireNode(options.wrapper, name, 'stage');
    if (!rig || typeof rig.apply !== 'function') throw new TypeError(name + ': rig.apply is required');
    kit.requireNode(rig.root, name, 'stage');
    if (wrapper === rig.root || rig.root.parentNode !== wrapper) {
      throw new TypeError(name + ': wrapper must be the parent of rig.root');
    }
    var at = kit.requireBox(options, ['at'], name).at;
    var recede = kit.requireBox(options.recede, ['y', 'scale'], name + '.recede');
    if (recede.scale <= 0) throw new TypeError(name + ': recede.scale must be positive');
    var skin = options.skin;
    if (!skin || typeof skin.before !== 'string' || typeof skin.after !== 'string' ||
        /\s/.test(skin.before) || /\s/.test(skin.after)) {
      throw new TypeError(name + ': skin.before and skin.after must be single class names or empty strings');
    }
    var target = kit.requireNode(skin.target, name);
    var before = skin.before;
    var after = skin.after;
    var defaults = { props: 0.25, outer: 0.45, inner: 0.45, recede: 0.55, hold: 0.2,
      inner2: 0.5, floor2: 0.45, outer2: 0.5, props2: 0.4 };
    var order = ['props', 'outer', 'inner', 'recede', 'hold', 'inner2', 'floor2', 'outer2', 'props2'];
    var phases = options.phases;
    if (phases !== undefined && (!phases || typeof phases !== 'object' || Array.isArray(phases))) {
      throw new TypeError(name + ': phases must be an object');
    }
    var starts = {};
    var ends = {};
    var cursor = at;
    order.forEach(function (key) {
      var value = phases && Object.prototype.hasOwnProperty.call(phases, key) ?
        kit.requireBox(phases, [key], name + '.phases')[key] : defaults[key];
      value = kit.finite(value, name + '.phases.' + key);
      if (value < 0) throw new TypeError(name + ': phase durations must be nonnegative');
      starts[key] = cursor;
      cursor = kit.finite(cursor + value, name + '.phase end');
      ends[key] = cursor;
    });
    var oldTransform = wrapper.style.transform;
    var hadBefore = before ? target.classList.contains(before) : false;
    var hadAfter = after ? target.classList.contains(after) : false;
    var disposed = false;

    function setClass(token, present) {
      if (!token) return;
      if (present) target.classList.add(token);
      else target.classList.remove(token);
    }
    function progress(t, key) {
      return kit.ease.inOut(kit.ramp(t, starts[key], ends[key]));
    }
    function apply(t) {
      if (disposed) return;
      t = kit.finite(t, name + '.t');
      // 阶段起点由时长累加得到，浮点误差可达 1e-15；换肤点用极小容差判断，保证 t 恰好等于起点时已换。
      var rebuilt = t >= starts.inner2 - 1e-9;
      var away = kit.ease.inOut3(kit.ramp(t, starts.recede, ends.recede));
      var back = kit.ease.inOut3(kit.ramp(t, starts.inner2, ends.props2));
      var distance = away * (1 - back);
      rig.apply({
        inner: (1 - progress(t, 'inner')) + progress(t, 'inner2'),
        outer: (1 - progress(t, 'outer')) + progress(t, 'outer2'),
        floor: (1 - progress(t, 'inner')) + progress(t, 'floor2'),
        prop: (1 - progress(t, 'props')) + progress(t, 'props2')
      });
      wrapper.style.transform = 'translateY(' + (recede.y * distance) + 'px) scale(' +
        (1 + (recede.scale - 1) * distance) + ')';
      setClass(before, false);
      setClass(after, false);
      setClass(rebuilt ? after : before, true);
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      wrapper.style.transform = oldTransform;
      setClass(before, hadBefore);
      setClass(after, hadAfter);
      rig.apply({ inner: 1, outer: 1, floor: 1, prop: 1 });
    }

    apply(0);
    return { root: wrapper, apply: apply, dispose: dispose };
  });
})(window);

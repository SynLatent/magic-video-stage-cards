/* prop.states · 多部件、命名状态的本期专属道具
 *
 * 为什么存在：每期的物不同（闸门、卡纸堆、抽屉…），卡片不可能预置全部；但手写 DOM 容易写出
 * static 定位、被继承隐藏、没有 CSS 的节点。本积木只管工程保护（定位、显隐、皮肤、确定性插值），
 * 物长什么样、分几块、有哪些状态全部由工程以数据描述。
 */
(function (global) {
  "use strict";
  if (!global.HarnessStageKit) throw new Error('stage-kit core must load before blocks/prop-states.js');

  var CSS_TEXT = [
    '.hf-kit-prop-states-root{transform-style:preserve-3d;pointer-events:none;}',
    '.hf-kit-prop-states-part{box-sizing:border-box;transform-style:preserve-3d;backface-visibility:hidden;}',
    '.hf-kit-prop-states-img{display:block;width:100%;height:100%;user-select:none;}',
    '.hf-kit-prop-states-framed{box-shadow:inset 0 0 0 6px rgba(255,255,255,.92),8px 10px 0 rgba(45,28,12,.22);border-radius:10px;overflow:hidden;}',
    '.hf-kit-prop-states-paper{box-shadow:inset 0 0 0 6px rgba(255,255,255,.9),8px 10px 0 rgba(45,28,12,.2);}',
    '.hf-kit-prop-states-label{display:flex;align-items:center;justify-content:center;white-space:nowrap;line-height:1.2;' +
      'font-family:inherit;border-radius:10px;box-shadow:inset 0 0 0 4px rgba(255,255,255,.9),5px 6px 0 rgba(45,28,12,.2);}'
  ].join('');
  var POSE_KEYS = ['x', 'y', 'r', 'rx', 'ry', 's', 'o'];
  var REST = { x: 0, y: 0, r: 0, rx: 0, ry: 0, s: 1, o: 1 };
  var EASES = ['linear', 'inOut', 'out2', 'out3', 'inOut3', 'sineInOut', 'quintOut', 'backOut'];

  function chars(text) { return String(text).match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\s\S]/g) || []; }
  function copyPose(pose) { var out = {}; POSE_KEYS.forEach(function (key) { out[key] = pose[key]; }); return out; }

  global.HarnessStageKit.define('prop.states', function (options, kit) {
    var mount = kit.requireNode(options.mount, 'prop.states', 'stage');
    var box = kit.requireBox(options.box, null, 'prop.states.box');
    var perspective = options.perspective === undefined ? 1400 : kit.requireBox(options, ['perspective'], 'prop.states').perspective;
    if (box.w <= 0 || box.h <= 0 || perspective <= 0) throw new TypeError('prop.states: box and perspective must be positive');
    if (!Array.isArray(options.parts) || !options.parts.length) throw new TypeError('prop.states: parts must be a non-empty array');
    if (!options.states || typeof options.states !== 'object') throw new TypeError('prop.states: states must be an object');
    if (typeof options.start !== 'string' || !options.states[options.start]) throw new TypeError('prop.states: start must name a state');
    if (!Array.isArray(options.steps)) throw new TypeError('prop.states: steps must be an array');

    var ids = {};
    var parts = options.parts.map(function (spec, index) {
      if (!spec || typeof spec.id !== 'string' || !spec.id) throw new TypeError('prop.states: parts[' + index + '].id is required');
      if (ids[spec.id]) throw new TypeError('prop.states: duplicate part id ' + spec.id);
      ids[spec.id] = true;
      var partBox = kit.requireBox(spec.box, null, 'prop.states.parts.' + spec.id + '.box');
      if (partBox.w <= 0 || partBox.h <= 0) throw new TypeError('prop.states: part ' + spec.id + ' box must be positive');
      var look = spec.look || {};
      if (['img', 'svg', 'paper', 'label'].indexOf(look.kind) < 0) {
        throw new TypeError('prop.states: part ' + spec.id + ' look.kind must be img, svg, paper or label');
      }
      if (look.kind === 'img' && (typeof look.src !== 'string' || typeof look.alpha !== 'boolean')) {
        throw new TypeError('prop.states: img part ' + spec.id + ' needs src and an explicit alpha boolean');
      }
      if (look.kind === 'svg' && typeof look.markup !== 'string' && typeof look.src !== 'string') {
        throw new TypeError('prop.states: svg part ' + spec.id + ' needs markup or src');
      }
      if (look.kind === 'label') {
        var count = chars(look.text || '').length;
        if (count < 1 || count > 8) throw new TypeError('prop.states: label part ' + spec.id + ' text must be 1 to 8 characters');
      }
      return { id: spec.id, box: partBox, origin: spec.origin || '50% 50%', look: look };
    });

    function readPoses(name) {
      var state = options.states[name];
      if (!state || typeof state !== 'object') throw new TypeError('prop.states: unknown state ' + name);
      Object.keys(state).forEach(function (id) {
        if (!ids[id]) throw new TypeError('prop.states: state ' + name + ' names unknown part ' + id);
        Object.keys(state[id] || {}).forEach(function (key) {
          if (POSE_KEYS.indexOf(key) < 0) throw new TypeError('prop.states: state ' + name + '.' + id + ' has unknown pose key ' + key);
          kit.finite(state[id][key], 'prop.states.' + name + '.' + id + '.' + key);
        });
      });
      return state;
    }
    // resolved[k]：完成前 k 个步骤后的每件姿态。状态只写它改变的件与轴，其余沿用上一状态。
    var resolved = [{}];
    var startState = readPoses(options.start);
    parts.forEach(function (part) {
      var pose = copyPose(REST);
      Object.keys(startState[part.id] || {}).forEach(function (key) { pose[key] = Number(startState[part.id][key]); });
      resolved[0][part.id] = pose;
    });
    var previousEnd = -Infinity;
    var steps = options.steps.map(function (spec, index) {
      var name = 'prop.states.steps[' + index + ']';
      var at = kit.requireBox(spec, ['at'], name).at;
      var dur = spec.dur === undefined ? 0.5 : kit.requireBox(spec, ['dur'], name).dur;
      var stagger = spec.stagger === undefined ? 0 : kit.requireBox(spec, ['stagger'], name).stagger;
      var easeName = spec.ease === undefined ? 'out3' : spec.ease;
      if (dur <= 0 || stagger < 0) throw new TypeError(name + ': dur must be positive and stagger non-negative');
      if (EASES.indexOf(easeName) < 0) throw new TypeError(name + ': unknown ease ' + easeName);
      var target = readPoses(spec.to);
      var before = resolved[index];
      var after = {};
      var changed = [];
      parts.forEach(function (part) {
        var pose = copyPose(before[part.id]);
        var delta = target[part.id];
        if (delta) {
          Object.keys(delta).forEach(function (key) { pose[key] = Number(delta[key]); });
          changed.push(part.id);
        }
        after[part.id] = pose;
      });
      resolved.push(after);
      var end = at + dur + stagger * Math.max(0, changed.length - 1);
      if (at < previousEnd) throw new TypeError(name + ': starts before the previous step ends; steps must not overlap');
      previousEnd = end;
      return { at: at, dur: dur, stagger: stagger, changed: changed,
        ease: easeName === 'backOut' ? kit.ease.backOut(1.7) : kit.ease[easeName] };
    });

    kit.ensureCss('hf-kit-prop-states', CSS_TEXT);
    var root = kit.abs(kit.make('div', 'hf-kit-prop-states-root', mount), box);
    root.style.perspective = perspective + 'px';
    var nodes = {};
    parts.forEach(function (part) {
      var look = part.look;
      var node = kit.abs(kit.make('div', 'hf-kit-prop-states-part', root), part.box);
      node.style.transformOrigin = part.origin;
      if (look.kind === 'img' || look.kind === 'svg') {
        if (look.kind === 'img' && !look.alpha) node.classList.add('hf-kit-prop-states-framed');
        var image = kit.make('img', 'hf-kit-prop-states-img', node);
        image.alt = '';
        image.draggable = false;
        image.src = look.kind === 'svg' && typeof look.markup === 'string'
          ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(look.markup) : look.src;
        image.style.objectFit = look.fit === 'cover' ? 'cover' : 'contain';
        if (look.position) image.style.objectPosition = String(look.position);
      } else if (look.kind === 'paper') {
        node.classList.add('hf-kit-prop-states-paper');
        node.style.backgroundColor = look.color === undefined ? '#fdf3dd' : look.color;
        node.style.borderRadius = (look.radius === undefined ? 12 : kit.finite(look.radius, 'radius')) + 'px';
      } else {
        node.classList.add('hf-kit-prop-states-label');
        node.textContent = look.text;
        node.style.backgroundColor = look.paper === undefined ? '#fdf3dd' : look.paper;
        node.style.color = look.ink === undefined ? '#2a2018' : look.ink;
        node.style.fontSize = (look.size === undefined ? 28 : kit.finite(look.size, 'size')) + 'px';
      }
      nodes[part.id] = node;
    });
    var disposed = false;

    function write(node, pose) {
      node.style.transform = 'translate3d(' + pose.x.toFixed(2) + 'px,' + pose.y.toFixed(2) + 'px,0) rotateX(' +
        pose.rx.toFixed(2) + 'deg) rotateY(' + pose.ry.toFixed(2) + 'deg) rotate(' + pose.r.toFixed(2) + 'deg) scale(' +
        pose.s.toFixed(4) + ')';
      kit.shown(node, pose.o);
    }
    function apply(t) {
      if (disposed) return;
      t = kit.finite(t, 'prop.states.t');
      var index = 0;
      while (index < steps.length && t >= steps[index].at) index += 1;
      var step = index ? steps[index - 1] : null;
      parts.forEach(function (part) {
        var to = resolved[index][part.id];
        var order = step ? step.changed.indexOf(part.id) : -1;
        if (order < 0) { write(nodes[part.id], to); return; }
        var from = resolved[index - 1][part.id];
        var start = step.at + order * step.stagger;
        var p = step.ease(kit.ramp(t, start, start + step.dur));
        var pose = {};
        POSE_KEYS.forEach(function (key) { pose[key] = kit.lerp(from[key], to[key], p); });
        write(nodes[part.id], pose);
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

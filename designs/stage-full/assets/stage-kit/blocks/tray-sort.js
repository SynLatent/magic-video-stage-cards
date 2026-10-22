(function (global) {
  "use strict";
  if (!global.HarnessStageKit) throw new Error('stage-kit core must load before blocks/tray-sort.js');

  var CSS_TEXT = [
    '.hf-kit-tray-sort-root,.hf-kit-tray-sort-leaders{pointer-events:none;font-family:inherit;}',
    '.hf-kit-tray-sort-tray{border-radius:26px;box-shadow:inset 0 0 0 7px rgba(255,255,255,.9),10px 12px 0 rgba(45,28,12,.18);}',
    '.hf-kit-tray-sort-hue{border-radius:8px;}',
    '.hf-kit-tray-sort-label{right:26px;font-size:30px;color:var(--ink,#2a2018);letter-spacing:2px;white-space:nowrap;}',
    '.hf-kit-tray-sort-object{object-fit:contain;transform-origin:50% 50%;user-select:none;}',
    '.hf-kit-tray-sort-svg{overflow:visible;}',
    '.hf-kit-tray-sort-leader{fill:none;stroke-linecap:round;stroke-dasharray:16 14;}'
  ].join('');

  global.HarnessStageKit.define('tray.sort', function (options, kit) {
    var mount = kit.requireNode(options.mount, 'tray.sort', 'stage');
    var trayIn = kit.requireBox(options.trayIn, ['at'], 'tray.sort.trayIn');
    var trays = [];
    var objects = [];
    var leaders = options.leaders;
    var leaderMount = null;
    var leaderWidth = 5;
    var leaderColor = '#ffd48a';
    var root;
    var leaderRoot = null;
    var svg = null;
    var disposed = false;

    function invalid(message) { throw new TypeError('stage-kit.tray.sort: ' + message); }
    function duration(value, fallback, name) {
      var dur = value === undefined ? fallback : kit.requireBox({ dur: value }, ['dur'], name).dur;
      if (dur <= 0) invalid(name + '.dur must be positive');
      return dur;
    }
    function id(value) {
      if (typeof value !== 'string' || !value.trim()) invalid('id must be a nonempty string');
      return value;
    }
    function colors(value, count, name) {
      if (!Array.isArray(value) || value.length !== count) invalid(name + ' requires ' + count + ' colors');
      return value.map(function (color) {
        if (typeof color !== 'string' || !color.trim()) invalid(name + ' colors must be nonempty strings');
        return color;
      });
    }
    trayIn.dur = duration(options.trayIn.dur, 0.45, 'trayIn');
    if (!Array.isArray(options.trays) || !Array.isArray(options.objects)) invalid('trays and objects must be arrays');
    options.trays.forEach(function (entry) {
      var tray = kit.requireBox(entry, null, 'tray.sort.tray');
      tray.id = id(entry.id);
      trays.forEach(function (other) { if (other.id === tray.id) invalid('duplicate tray id: ' + tray.id); });
      if (tray.w <= 0 || tray.h <= 0) invalid('tray dimensions must be positive');
      if (typeof entry.label !== 'string' || (entry.label.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\s\S]/g) || []).length > 6) invalid('label must be a string of at most 6 characters');
      tray.label = entry.label;
      tray.paper = colors(entry.paper, 2, 'paper');
      tray.hue = entry.hue === undefined ? null : colors(entry.hue, 3, 'hue');
      trays.push(tray);
    });
    options.objects.forEach(function (entry) {
      var item = kit.requireBox(entry, ['w', 'h', 'at'], 'tray.sort.object');
      var target = null;
      item.id = id(entry.id);
      objects.forEach(function (other) { if (other.id === item.id) invalid('duplicate object id: ' + item.id); });
      if (item.w <= 0 || item.h <= 0) invalid('object dimensions must be positive');
      item.from = kit.requireBox(entry.from, ['x', 'y'], 'tray.sort.from');
      item.to = kit.requireBox(entry.to, ['x', 'y'], 'tray.sort.to');
      trays.forEach(function (tray) { if (tray.id === entry.to.tray) target = tray; });
      if (!target) invalid('unknown tray id: ' + entry.to.tray);
      item.to.x += target.x;
      item.to.y += target.y;
      item.dur = duration(entry.dur, 0.8, 'object');
      if (typeof entry.markup !== 'string' || !/^\s*<svg\b[\s\S]*<\/svg>\s*$/i.test(entry.markup)) invalid('markup must be an inline SVG string');
      item.markup = entry.markup;
      objects.push(item);
    });
    if (leaders !== undefined) {
      if (!leaders) invalid('leaders must contain an overlay mount');
      leaderMount = kit.requireNode(leaders.mount, 'tray.sort.leaders', 'overlay');
      leaderWidth = leaders.width === undefined ? 5 : kit.requireBox(leaders, ['width'], 'tray.sort.leaders').width;
      if (leaderWidth <= 0) invalid('leaders.width must be positive');
      leaderColor = leaders.color === undefined ? '#ffd48a' : colors([leaders.color], 1, 'leaders.color')[0];
    }

    kit.ensureCss('hf-kit-tray-sort', CSS_TEXT);
    root = kit.abs(kit.make('div', 'hf-kit-tray-sort-root', mount), { x: 0, y: 0, w: 1920, h: 1080 });
    trays.forEach(function (tray) {
      tray.node = kit.abs(kit.make('div', 'hf-kit-tray-sort-tray', root), tray);
      tray.node.style.background = 'linear-gradient(180deg,' + tray.paper.join(',') + ')';
      if (tray.hue) {
        tray.band = kit.abs(kit.make('div', 'hf-kit-tray-sort-hue', tray.node), { x: 24, y: 22, w: 120, h: 16 });
        tray.band.style.background = 'linear-gradient(90deg,' + tray.hue.join(',') + ')';
      }
      tray.text = kit.abs(kit.make('div', 'hf-kit-tray-sort-label', tray.node), { y: 14 });
      tray.text.textContent = tray.label;
    });
    if (leaderMount) {
      leaderRoot = kit.abs(kit.make('div', 'hf-kit-tray-sort-leaders', leaderMount), { x: 0, y: 0, w: 1920, h: 1080 });
      // kit.make uses HTML createElement; parse SVG inside its wrapper for the SVG namespace.
      leaderRoot.innerHTML = '<svg class="hf-kit-tray-sort-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">' + objects.map(function () {
        return '<path class="hf-kit-tray-sort-leader"></path>';
      }).join('') + '</svg>';
      svg = kit.abs(leaderRoot.firstChild, { x: 0, y: 0, w: 1920, h: 1080 });
    }
    objects.forEach(function (item, index) {
      item.node = kit.abs(kit.make('img', 'hf-kit-tray-sort-object', root), { x: item.from.x, y: item.from.y, w: item.w, h: item.h });
      item.node.alt = '';
      item.node.draggable = false;
      item.node.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(item.markup);
      if (svg) {
        item.path = kit.abs(svg.children[index]);
        item.path.setAttribute('stroke', leaderColor);
        item.path.setAttribute('stroke-width', String(leaderWidth));
      }
    });

    function apply(t) {
      if (disposed) return;
      t = kit.finite(t, 'tray.sort.t');
      var enter = kit.ease.out3(kit.ramp(t, trayIn.at, trayIn.at + trayIn.dur));
      kit.shown(root, 1);
      trays.forEach(function (tray) {
        tray.node.style.transform = 'translateY(' + (34 * (1 - enter)) + 'px)';
        kit.shown(tray.node, enter);
        kit.shown(tray.text, enter > 0 ? 1 : 0);
        if (tray.band) kit.shown(tray.band, enter > 0 ? 1 : 0);
      });
      if (leaderRoot) { kit.shown(leaderRoot, 1); kit.shown(svg, 1); }
      objects.forEach(function (item) {
        var p = kit.ease.inOut(kit.ramp(t, item.at, item.at + item.dur));
        var x = kit.lerp(item.from.x, item.to.x, p);
        var y = kit.lerp(item.from.y, item.to.y, p);
        var pulse = kit.ramp(t, item.at + item.dur, item.at + item.dur + 0.12);
        var scale = 1 + 0.07 * (1 - Math.abs(2 * pulse - 1));
        item.node.style.left = x + 'px';
        item.node.style.top = y + 'px';
        item.node.style.transform = 'scale(' + scale + ')';
        kit.shown(item.node, 1);
        if (item.path) {
          item.path.setAttribute('d', 'M' + (item.from.x + item.w / 2) + ' ' + (item.from.y + item.h / 2) + 'L' + (x + item.w / 2) + ' ' + (y + item.h / 2));
          kit.shown(item.path, t >= item.at - 0.1 && t <= item.at + item.dur + 0.25 ? 0.5 : 0);
        }
      });
    }
    function object(objectId) {
      var node;
      objects.forEach(function (item) { if (item.id === objectId) node = item.node; });
      return node;
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      if (root.parentNode) root.parentNode.removeChild(root);
      if (leaderRoot && leaderRoot.parentNode) leaderRoot.parentNode.removeChild(leaderRoot);
    }
    apply(0);
    return { root: root, apply: apply, dispose: dispose, object: object };
  });
})(window);

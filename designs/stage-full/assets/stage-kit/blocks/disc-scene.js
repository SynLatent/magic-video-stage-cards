/* 第一层圆盘换景与逐件装配；由全片秒数重建状态。 */
(function (global) {
  "use strict";
  if (!global.HarnessStageKit) throw new Error('stage-kit core must load before blocks/disc-scene.js');

  var CSS_TEXT =
    '.hf-kit-disc-scene-root{width:1920px;height:1080px;overflow:hidden;isolation:isolate;pointer-events:none}' +
    '.hf-kit-disc-scene-disc{border-radius:50%;overflow:hidden;transform-origin:50% 50%}' +
    '.hf-kit-disc-scene-half-a,.hf-kit-disc-scene-half-b{overflow:hidden;transform-origin:50% 50%}' +
    '.hf-kit-disc-scene-half-b{transform:rotate(180deg)}' +
    '.hf-kit-disc-scene-scene-plane{perspective:2400px;isolation:isolate}' +
    '.hf-kit-disc-scene-backdrop{object-fit:fill;display:block}' +
    '.hf-kit-disc-scene-piece{backface-visibility:hidden;transform-style:flat;will-change:transform}' +
    '.hf-kit-disc-scene-inner{width:100%;height:100%}' +
    '.hf-kit-disc-scene-image{display:block;width:100%;height:100%;object-fit:fill}';

  global.HarnessStageKit.define('disc.scene', function (options, kit) {
    var mount = kit.requireNode(options.mount, 'disc.scene', 'background');
    function text(value, name) {
      if (typeof value !== 'string' || !value) throw new TypeError('disc.scene: ' + name + ' must be a nonempty string');
      return value;
    }
    function number(value, name) {
      if (value == null) throw new TypeError('disc.scene: ' + name + ' is required');
      return kit.finite(value, name);
    }
    function positive(value, name) {
      value = number(value, name);
      if (value <= 0) throw new TypeError('disc.scene: ' + name + ' must be positive');
      return value;
    }
    function array(value, name) {
      if (!Array.isArray(value)) throw new TypeError('disc.scene: ' + name + ' must be an array');
      return value;
    }
    function origin(value) {
      if (value == null) return '50% 100%';
      if (Array.isArray(value) && value.length === 2) return number(value[0], 'origin.x') + 'px ' + number(value[1], 'origin.y') + 'px';
      return text(value, 'origin');
    }
    function rank(row) {
      if (row.order != null) return row.order;
      var k = row.kind;
      if (k === 'floor') return 0;
      if (/sky|backing/.test(k)) return 1;
      if (/wall|panel|alcove/.test(k)) return 2;
      if (/beam|roof|header|frame/.test(k)) return 3;
      if (/hill|lake|ground/.test(k)) return 4;
      if (/lamp|hanging/.test(k)) return 7;
      return 5;
    }
    function fromState(row, i) {
      var s = { x: 0, y: 0, rx: 0, ry: 0, r: 0 }, k = row.kind;
      if (row.motion === 'left') { s.x = -420; s.y = 20; }
      else if (row.motion === 'right') { s.x = 420; s.y = 20; }
      else if (row.motion === 'rise') s.y = 180;
      else if (row.motion === 'drop') s.y = -Math.max(300, row.y + row.h + 60);
      else if (row.motion === 'fold') { s.y = 24; s.rx = 78; }
      else if (k === 'floor') { s.y = 300; s.rx = 68; }
      else if (/sky/.test(k)) s.y = -200;
      else if (/beam|roof|header|frame/.test(k)) { s.y = -900; s.r = i % 2 ? 1.5 : -1.5; }
      else if (/wall|panel|backing|alcove/.test(k)) { s.y = 24; s.rx = 78; }
      else if (/lamp|hanging/.test(k)) { s.y = -Math.max(300, row.y + row.h + 60); s.r = i % 2 ? 2 : -2; }
      else if (/hill|lake|ground/.test(k)) { s.y = 200; s.rx = 35; }
      else { s.x = row.x + row.w / 2 < 960 ? -420 : 420; s.y = 28; }
      return s;
    }
    var base = text(options.base, 'base');
    var discOptions = options.disc == null ? { diameter: 4400, centre: [960, 1080] } : options.disc;
    var diameter = positive(discOptions.diameter, 'disc.diameter');
    var centre = array(discOptions.centre, 'disc.centre');
    var cx = number(centre[0], 'disc.centre[0]'), cy = number(centre[1], 'disc.centre[1]');
    var radius = diameter / 2;
    var turnDur = positive(options.turnDur === undefined ? 2.2 : options.turnDur, 'turnDur');
    var boardDur = positive(options.boardDur === undefined ? 1.6 : options.boardDur, 'boardDur');
    function board(value) {
      if (value == null) return null;
      if (!global.HarnessStageRig || !global.HarnessStageRig.createBackdrop) throw new TypeError('disc.scene: scene.board needs runtime/stage-rig.js loaded first');
      if (typeof value !== 'object') throw new TypeError('disc.scene: scene.board must be an object');
      Object.keys(value).forEach(function (key) {
        if (['wall', 'floor', 'horizon', 'panels'].indexOf(key) < 0) throw new TypeError('disc.scene: unknown scene.board field ' + key);
      });
      return { wall: value.wall, floor: value.floor, horizon: value.horizon, panels: value.panels };
    }
    var sceneIds = [], scenes = array(options.scenes, 'scenes').map(function (scene) {
      var id = text(scene.id, 'scene.id'), ids = [];
      if (sceneIds.indexOf(id) >= 0) throw new TypeError('disc.scene: duplicate scene ' + id);
      sceneIds.push(id);
      return {
        id: id, color: text(scene.color, 'scene.color'),
        backdrop: scene.backdrop == null ? null : text(scene.backdrop, 'backdrop'),
        board: board(scene.board),
        pieces: array(scene.pieces, 'pieces').map(function (piece, index) {
          var row = kit.requireBox(piece, ['x', 'y', 'w', 'h'], 'disc.scene');
          row.id = text(piece.id, 'piece.id');
          if (ids.indexOf(row.id) >= 0) throw new TypeError('disc.scene: duplicate piece ' + row.id);
          ids.push(row.id);
          row.file = text(piece.file, 'piece.file');
          row.kind = text(piece.kind, 'piece.kind');
          row.motion = piece.motion;
          row.group = piece.group == null ? null : text(piece.group, 'piece.group');
          row.order = piece.order == null ? null : number(piece.order, 'piece.order');
          row.finish = piece.finish === true;
          row.origin = origin(piece.origin);
          row.index = index;
          return row;
        })
      };
    });
    var entries = array(options.entries, 'entries').map(function (entry, index) {
      var sceneIndex = sceneIds.indexOf(entry.scene);
      if (sceneIndex < 0) throw new TypeError('disc.scene: unknown scene ' + entry.scene);
      return {
        scene: scenes[sceneIndex], enter: index === 0 && entry.turnAt === null ? 0 : number(entry.turnAt, 'turnAt'),
        buildAt: number(entry.buildAt, 'buildAt'),
        buildDur: positive(entry.buildDur === undefined ? 4.2 : entry.buildDur, 'buildDur')
      };
    });
    kit.ensureCss('hf-kit-disc-scene', CSS_TEXT);
    function node(tag, suffix, parent, box) {
      return kit.abs(kit.make(tag, 'hf-kit-disc-scene-' + suffix, parent), box);
    }
    var root = node('div', 'root', mount, { x: 0, y: 0, w: 1920, h: 1080 });
    var disc = node('div', 'disc', root, { x: cx - radius, y: cy - radius, w: diameter, h: diameter });
    var halves = [
      node('div', 'half-a', disc, { x: 0, y: 0, w: diameter, h: radius }),
      node('div', 'half-b', disc, { x: 0, y: radius, w: diameter, h: radius })
    ];
    var disposed = false;
    function image(file, parent, suffix, w, h) {
      var im = node('img', suffix, parent, { x: 0, y: 0, w: w, h: h });
      im.alt = ''; im.draggable = false; im.src = base + file;
      return im;
    }
    entries.forEach(function (entry, index) {
      entry.plane = node('div', 'scene-plane', halves[index % 2], { x: radius - 960, y: radius - 1080, w: 1920, h: 1080 });
      entry.plane.style.backgroundColor = entry.scene.color;
      entry.plane.setAttribute('data-scene', entry.scene.id);
      if (entry.scene.backdrop) entry.backdrop = image(entry.scene.backdrop, entry.plane, 'backdrop', 1920, 1080);
      // 进阶背景：本景自带一块全屏纸板，转正后先展开，小素材再逐件落到纸板上。
      var piecesAt = entry.buildAt, piecesDur = entry.buildDur;
      if (entry.scene.board) {
        var b = entry.scene.board;
        entry.board = global.HarnessStageRig.createBackdrop({ mount: entry.plane, panels: b.panels, horizon: b.horizon, props: false,
          skins: { scene: { wall: b.wall, floor: b.floor } } }).unfold({ at: entry.buildAt, duration: boardDur });
        piecesAt = entry.buildAt + boardDur;
        piecesDur = entry.buildDur - boardDur;
        if (piecesDur < 1) throw new TypeError('disc.scene: buildDur must leave at least 1 s after the board unfolds');
      }
      entry.pieces = entry.scene.pieces.map(function (row) {
        var el = node('div', 'piece', entry.plane, row);
        var inner = node('div', 'inner', el, { x: 0, y: 0, w: row.w, h: row.h });
        el.style.transformOrigin = inner.style.transformOrigin = row.origin;
        el.setAttribute('data-component', row.id);
        return { row: row, el: el, inner: inner, image: image(row.file, inner, 'image', row.w, row.h) };
      });
      var ordered = entry.pieces.filter(function (p) { return !p.row.finish; }).sort(function (a, b) {
        return rank(a.row) - rank(b.row) || a.row.index - b.row.index;
      });
      var groups = [];
      ordered.forEach(function (p) {
        var key = p.row.group === null ? 'piece:' + p.row.id : 'group:' + p.row.group;
        if (groups.indexOf(key) < 0) groups.push(key);
        p.groupIndex = groups.indexOf(key);
      });
      entry.pieces.forEach(function (p) {
        p.ts = p.row.finish ? piecesAt + piecesDur - 0.15 : piecesAt + p.groupIndex * (piecesDur - 1) / Math.max(1, groups.length - 1);
        p.from = fromState(p.row, p.groupIndex);
        p.impact = { x: 0, y: 0, rx: 0, ry: 0, r: 0 };
        var primary = ['rx', 'ry', 'y', 'x'].filter(function (key) { return p.from[key] !== 0; })[0];
        if (primary) p.impact[primary] = primary === 'rx' || primary === 'ry' ? -1.5 : p.from[primary] > 0 ? -6 : 6;
      });
    });
    function apply(t) {
      if (disposed) return;
      t = number(t, 't');
      var angle = 0, colors = ['transparent', 'transparent'];
      kit.shown(root, 1); kit.shown(disc, 1);
      entries.forEach(function (entry, index) {
        if (t >= entry.enter) {
          colors[index % 2] = entry.scene.color;
          if (index > 0) angle = (index - 1) * 180 + 180 * kit.ease.inOut(kit.ramp(t, entry.enter, entry.enter + turnDur));
        }
        var active = t >= entry.enter && (!entries[index + 2] || t < entries[index + 2].enter);
        kit.shown(entry.plane, active ? 1 : 0);
        if (entry.backdrop) kit.shown(entry.backdrop, active ? 1 : 0);
        if (entry.board) entry.board.apply(t);
        entry.pieces.forEach(function (p) {
          var s = kit.settle(t, p.ts, 0.65, 0.16), state = {};
          ['x', 'y', 'rx', 'ry', 'r'].forEach(function (key) {
            state[key] = p.row.finish || s.phase === 3 ? 0 : s.phase === 0 ? p.from[key] : s.phase === 1 ? kit.lerp(p.from[key], p.impact[key], s.p) : kit.lerp(p.impact[key], 0, s.p);
          });
          p.el.style.transform = 'translate3d(' + state.x + 'px, ' + state.y + 'px, 0) rotateX(' + state.rx + 'deg) rotateY(' + state.ry + 'deg) rotate(' + state.r + 'deg)';
          var visible = active && t >= p.ts ? 1 : 0;
          kit.shown(p.el, visible); kit.shown(p.inner, visible); kit.shown(p.image, visible);
        });
      });
      disc.style.transform = 'rotate(' + angle + 'deg)';
      halves.forEach(function (half, index) {
        half.style.backgroundColor = colors[index];
        half.style.transform = index ? 'rotate(180deg)' : 'rotate(0deg)';
        kit.shown(half, 1);
      });
    }
    apply(0);
    return {
      root: root, apply: apply,
      piece: function (entryIndex, pieceId) {
        var entry = entries[entryIndex], found;
        if (entry) found = entry.pieces.filter(function (p) { return p.row.id === pieceId; })[0];
        if (!found) throw new Error('disc.scene: unknown piece ' + entryIndex + '/' + pieceId);
        return found.inner;
      },
      dispose: function () {
        if (disposed) return;
        disposed = true;
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  });
})(window);

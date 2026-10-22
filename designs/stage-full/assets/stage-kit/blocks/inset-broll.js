(function (global) {
  "use strict";
  if (!global.HarnessStageKit) throw new Error('stage-kit core must load before blocks/inset-broll.js');

  var CSS_TEXT = [
    '.hf-kit-inset-broll-root{box-sizing:border-box;background:#f5f0e5;border:10px solid #f5f0e5;border-radius:8px;box-shadow:9px 12px 0 rgba(35,30,25,.22);}',
    '.hf-kit-inset-broll-window{inset:0;overflow:hidden;border-radius:2px;}',
    '.hf-kit-inset-broll-media{width:100%;height:100%;object-fit:cover;transform-origin:50% 50%;}',
    '.hf-kit-inset-broll-shade{inset:0;pointer-events:none;box-shadow:inset 0 2px 12px rgba(35,30,25,.24);}',
    '.hf-kit-inset-broll-label{left:12px;max-width:calc(100% - 24px);box-sizing:border-box;padding:4px 10px;background:#f5f0e5;color:#302b26;font:inherit;line-height:1.3;white-space:nowrap;border-radius:3px;}'
  ].join('\n');

  global.HarnessStageKit.define('inset.broll', function (options, kit) {
    var mount = kit.requireNode(options.mount, 'inset.broll', 'stage');
    var box = kit.requireBox(options.box, null, 'inset.broll.box');
    var safe = kit.requireBox(options.safe, ['bottom'], 'inset.broll.safe');
    var enter = options.enter || {};
    var at = required(enter.at, 'enter.at');
    var dur = positive(enter.dur == null ? 0.5 : enter.dur, 'enter.dur');
    var exit = options.exit;
    var out = exit ? required(exit.at, 'exit.at') : null;
    var outDur = exit ? positive(exit.dur == null ? 0.4 : exit.dur, 'exit.dur') : null;
    var media = options.media || {};
    var move = options.move;
    var start = at + dur;
    var end = out;
    var zoom = [1, 1];
    var pan = [[0, 0], [0, 0]];
    var label = options.label;
    var distance = Math.max(260, box.w * 0.3);
    var dx = enter.from === 'left' ? -distance : enter.from === 'right' ? distance : 0;
    var dy = enter.from === 'bottom' ? distance : 0;
    var root, viewport, content, shade, tag, video;
    var disposed = false;

    function required(value, name) {
      if (value == null) throw new TypeError('inset.broll: ' + name + ' is required');
      return kit.finite(value, 'inset.broll.' + name);
    }
    function positive(value, name) {
      var n = required(value, name);
      if (n <= 0) throw new TypeError('inset.broll: ' + name + ' must be positive');
      return n;
    }
    function pair(value, name, isPositive) {
      if (!Array.isArray(value) || value.length !== 2) throw new TypeError('inset.broll: ' + name + ' requires two values');
      return [isPositive ? positive(value[0], name) : required(value[0], name),
        isPositive ? positive(value[1], name) : required(value[1], name)];
    }
    if (box.w <= 20 || box.h <= 20) throw new TypeError('inset.broll: box must fit the paper border');
    if (box.y + box.h > safe.bottom) throw new TypeError('inset.broll: box crosses safe.bottom');
    if (['left', 'right', 'bottom'].indexOf(enter.from) < 0) throw new TypeError('inset.broll: invalid enter.from');
    if (exit && out < start) throw new TypeError('inset.broll: exit.at precedes completed entrance');
    if (['img', 'video', 'node'].indexOf(media.kind) < 0) throw new TypeError('inset.broll: invalid media.kind');
    if (media.kind === 'node') kit.requireNode(media.node, 'inset.broll.media.node');
    else if (typeof media.src !== 'string' || !media.src) throw new TypeError('inset.broll: media.src is required');
    if (move) {
      zoom = pair(move.zoom, 'move.zoom', true);
      if (!Array.isArray(move.pan) || move.pan.length !== 2) throw new TypeError('inset.broll: move.pan requires two points');
      pan = [pair(move.pan[0], 'move.pan[0]'), pair(move.pan[1], 'move.pan[1]')];
      if (move.dur != null) {
        var moveEnd = start + positive(move.dur, 'move.dur');
        end = end == null ? moveEnd : Math.min(end, moveEnd);
      }
      if (end == null) throw new TypeError('inset.broll: move requires exit or move.dur');
    }
    if (label && (typeof label.text !== 'string' || label.text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '_').length > 8 || ['top', 'bottom'].indexOf(label.side) < 0)) {
      throw new TypeError('inset.broll: label requires at most eight characters and top/bottom side');
    }
    if (label && label.size !== undefined && !(Number.isFinite(label.size) && label.size > 0)) {
      throw new TypeError('inset.broll: label.size must be a positive number of px');
    }

    kit.ensureCss('hf-kit-inset-broll', CSS_TEXT);
    root = kit.abs(kit.make('div', 'hf-kit-inset-broll-root', mount), box);
    viewport = kit.abs(kit.make('div', 'hf-kit-inset-broll-window', root));
    content = kit.abs(kit.make(media.kind === 'node' ? 'div' : media.kind, 'hf-kit-inset-broll-media', viewport));
    if (media.kind === 'node') content.appendChild(media.node);
    else {
      if (media.kind === 'img') { content.alt = ''; content.draggable = false; }
      else {
        video = content;
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('muted', '');
        video.autoplay = false;
        video.preload = 'auto';
      }
      content.src = media.src;
    }
    shade = kit.abs(kit.make('div', 'hf-kit-inset-broll-shade', viewport));
    if (label) {
      tag = kit.abs(kit.make('div', 'hf-kit-inset-broll-label', root));
      tag.textContent = label.text;
      tag.style[label.side] = '0px';
      if (label.size !== undefined) tag.style.fontSize = label.size + 'px';
    }

    function apply(t) {
      if (disposed) return;
      t = required(t, 't');
      var visible = kit.window(t, at, dur, kit.ease.out3, out, outDur);
      var p = move ? kit.ease.sineInOut(kit.ramp(t, start, end)) : 0;
      root.style.transform = 'translate(' + (dx * (1 - visible)) + 'px,' + (dy * (1 - visible)) + 'px)';
      content.style.transform = 'translate(' + kit.lerp(pan[0][0], pan[1][0], p) + 'px,' + kit.lerp(pan[0][1], pan[1][1], p) + 'px) scale(' + kit.lerp(zoom[0], zoom[1], p) + ')';
      kit.shown(root, visible);
      kit.shown(viewport, visible > 0 ? 1 : 0);
      kit.shown(content, visible > 0 ? 1 : 0);
      kit.shown(shade, visible > 0 ? 1 : 0);
      if (tag) kit.shown(tag, visible > 0 ? 1 : 0);
      if (video) {
        var duration = video.duration;
        var target = Math.max(0, t - at);
        if (typeof duration === 'number' && isFinite(duration)) target = Math.min(target, Math.max(0, duration));
        // 元数据尚不可用时等待宿主下一次 apply，不用事件回调改变状态。
        // 同一 t 必须得到同一帧：不设容差，只要和目标不同就写回（写相同值由浏览器自己短路）。
        if (video.readyState > 0 && video.currentTime !== target) video.currentTime = target;
      }
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

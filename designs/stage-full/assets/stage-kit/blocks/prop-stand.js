(function (global) {
  "use strict";

  if (!global.HarnessStageKit) throw new Error('stage-kit core must load before blocks/prop-stand.js');

  var CSS_TEXT = [
    '.hf-kit-prop-stand-foot{transform-origin:50% 0;transform-style:preserve-3d;pointer-events:none;}',
    '.hf-kit-prop-stand-media{object-fit:contain;user-select:none;pointer-events:none;filter:drop-shadow(var(--hf-kit-prop-stand-rim) 0 0 white) drop-shadow(calc(-1 * var(--hf-kit-prop-stand-rim)) 0 0 white) drop-shadow(0 var(--hf-kit-prop-stand-rim) 0 white) drop-shadow(0 calc(-1 * var(--hf-kit-prop-stand-rim)) 0 white) drop-shadow(8px 10px 4px rgba(30,25,20,0.24));}'
  ].join('');

  global.HarnessStageKit.define('prop.stand', function (options, kit) {
    var mount = kit.requireNode(options.mount, 'prop.stand', 'stage');
    var box = kit.requireBox(options.box, ['x', 'y', 'w', 'h'], 'prop.stand.box');
    var at = kit.requireBox(options, ['at'], 'prop.stand').at;
    var dur = options.dur === undefined ? 0.45 : kit.requireBox(options, ['dur'], 'prop.stand').dur;
    var out = options.out === undefined ? null : kit.requireBox(options, ['out'], 'prop.stand').out;
    var outDur = out === null ? null : kit.requireBox(options, ['outDur'], 'prop.stand').outDur;
    var rim = options.rim === undefined ? 6 : kit.requireBox(options, ['rim'], 'prop.stand').rim;
    var media = options.media;
    var src;
    var disposed = false;

    if (box.w <= 0 || box.h <= 0 || dur <= 0 || rim < 0 || (outDur !== null && outDur <= 0)) {
      throw new TypeError('prop.stand: sizes and durations must be positive; rim must be nonnegative');
    }
    if (options.outDur !== undefined && out === null) throw new TypeError('prop.stand: outDur requires out');
    if (!media || (media.kind !== 'img' && media.kind !== 'svg')) throw new TypeError('prop.stand: media.kind must be img or svg');
    if (media.kind === 'img' && media.alpha !== true) throw new TypeError('prop.stand: img requires alpha:true');
    if (media.kind === 'svg' && typeof media.markup === 'string' && media.markup.trim()) {
      src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(media.markup);
    } else if (typeof media.src === 'string' && media.src.trim()) {
      src = media.src;
    } else {
      throw new TypeError('prop.stand: media requires src or SVG markup');
    }

    kit.ensureCss('hf-kit-prop-stand', CSS_TEXT);
    var foot = kit.abs(kit.make('div', 'hf-kit-prop-stand-foot', mount), box);
    foot.setAttribute('data-hf-kit-foot', '');
    var image = kit.abs(kit.make('img', 'hf-kit-prop-stand-media', foot), { x: 0, y: 0, w: box.w, h: box.h });
    image.alt = '';
    image.draggable = false;
    image.src = src;
    // 沿透明轮廓叠加白边，最后为整张纸片添加偏移投影。
    image.style.setProperty('--hf-kit-prop-stand-rim', rim + 'px');

    function enteringAngle(t) {
      var state = kit.settle(t, at, dur, 0.16);
      if (state.phase === 0) return 88;
      if (state.phase === 1) return kit.lerp(88, -1.5, state.p);
      if (state.phase === 2) return kit.lerp(-1.5, 0, state.p);
      return 0;
    }

    function apply(t) {
      if (disposed) return;
      t = kit.finite(t, 'prop.stand.t');
      var angle = enteringAngle(t);
      if (out !== null && t >= out) {
        angle = kit.lerp(enteringAngle(out), 88, kit.ease.out3(kit.ramp(t, out, out + outDur)));
      }
      var visible = t >= at && (out === null || t < out + outDur) ? 1 : 0;
      foot.style.transform = 'rotateX(' + angle + 'deg)';
      kit.shown(foot, visible);
      kit.shown(image, visible);
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

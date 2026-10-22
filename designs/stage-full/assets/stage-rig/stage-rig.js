/* Shared paper-stage fold mechanism for the stage-full / stage-light design cards.
 *
 * One rig, two cards: stage-full builds the full four-panel set, stage-light passes
 * { panels: 2 } and gets only the inner pair. Geometry and hinge owners are the same.
 *
 * Extracted from an authorised project mechanism:
 *   .set perspective > slide > wall + floor + props
 *   - four wall panels, each 480px wide, tiled across the 1920 frame;
 *   - inner pair anchored at the frame centre, folding +/-86deg;
 *   - outer panels are children of the inner panels and fold the opposite way +/-172deg;
 *   - the floor bridge hinges about its top edge out of -90deg;
 *   - prop feet hinge about their top edge from 88deg to stand.
 * Unfold order is inner first, then outer, each stage locking when it reaches 0deg.
 *
 * layout:'full' tiles the unfolded panels over the whole frame down to a horizon and lays the
 * floor from the horizon to the bottom edge, so the open set needs nothing behind it.
 * createBackdrop() drives that full-screen set by time with the standard background actions
 * unfold / refold (fold, switch skin while shut, unfold) / fold, shared by both stage cards.
 *
 * Ownership rule: this rig owns hinge rotation only. The scene's own wrapper owns
 * translation, scale and every other transform, so the fold can never be faked by
 * panning or fading the whole set.
 *
 * Determinism: apply(state) is a pure function of {inner, outer, floor, prop}, all
 * 0..1, so any seek or backwards seek rebuilds the complete set from scratch.
 * No RAF, no timers, no Date, no Math.random, no event/callback dependency.
 */
(function (global) {
  "use strict";

  var WALL_PANEL_WIDTH = 480;
  var WALL_PANEL_HEIGHT = 520;
  var WALL_TOP = 200;                 // stage base line is WALL_TOP + WALL_PANEL_HEIGHT
  var FLOOR_DEPTH = 360;
  var STAGE_WIDTH = 1920;
  var INNER_FOLD_DEG = 86;
  var OUTER_FOLD_DEG = 172;
  var FLOOR_FOLD_DEG = -90;
  var PROP_FOLD_DEG = 88;
  var FRAME_HEIGHT = 1080;
  var FULL_HORIZON = 700;             // full layout: backboard above, floor below

  var RIG_CSS = [
    ".hf-rig{position:absolute;inset:0;perspective:1800px;perspective-origin:50% 34%;transform-style:preserve-3d;}",
    ".hf-rig-deck{position:absolute;inset:0;transform-style:preserve-3d;}",
    ".hf-rig-props{position:absolute;inset:0;transform-style:preserve-3d;pointer-events:none;}",
    ".hf-rig-wall{position:absolute;top:" + WALL_TOP + "px;width:" + WALL_PANEL_WIDTH + "px;height:" + WALL_PANEL_HEIGHT + "px;transform-style:preserve-3d;backface-visibility:visible;}",
    ".hf-rig-wall-inner-left{left:" + (STAGE_WIDTH / 2 - WALL_PANEL_WIDTH) + "px;transform-origin:right center;}",
    ".hf-rig-wall-inner-right{left:" + (STAGE_WIDTH / 2) + "px;transform-origin:left center;}",
    ".hf-rig-wall-outer-left{top:0;left:-" + WALL_PANEL_WIDTH + "px;transform-origin:right center;}",
    ".hf-rig-wall-outer-right{top:0;left:" + WALL_PANEL_WIDTH + "px;transform-origin:left center;}",
    ".hf-rig-floor{position:absolute;left:0;top:" + (WALL_TOP + WALL_PANEL_HEIGHT) + "px;width:" + STAGE_WIDTH + "px;height:" + FLOOR_DEPTH + "px;transform-origin:50% 0;transform-style:preserve-3d;}",
    "[data-hf-prop-foot]{transform-origin:50% 0;transform-style:preserve-3d;}"
  ].join("");

  function ensureCss() {
    if (document.getElementById("hf-stage-rig-css")) return;
    var style = document.createElement("style");
    style.id = "hf-stage-rig-css";
    style.textContent = RIG_CSS;
    document.head.appendChild(style);
  }

  function make(tag, cls, parent) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (parent) parent.appendChild(node);
    return node;
  }

  function clamp01(value) {
    var number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return 0;
    return number >= 1 ? 1 : number;
  }

  function createPaperStage(options) {
    options = options || {};
    var mount = options.mount;
    if (!mount) throw new TypeError("createPaperStage requires a mount element");
    var panels = options.panels === 2 ? 2 : 4;
    var withFloor = options.floor !== false;
    var withProps = options.props !== false;
    var name = options.name || "set";
    var layout = options.layout == null ? "set" : options.layout;
    if (layout !== "set" && layout !== "full") throw new TypeError("createPaperStage: layout must be 'set' or 'full'");
    var horizon = options.horizon == null ? FULL_HORIZON : Number(options.horizon);
    if (!Number.isFinite(horizon) || horizon < 200 || horizon > 960) throw new TypeError("createPaperStage: horizon must be 200..960");

    ensureCss();

    var root = make("div", "hf-rig hf-rig-" + name, mount);
    root.setAttribute("aria-hidden", "true");
    var deck = make("div", "hf-rig-deck", root);

    var parts = { root: root, deck: deck, walls: [] };
    parts.innerLeft = make("div", "hf-rig-wall hf-rig-wall-inner-left", deck);
    parts.innerRight = make("div", "hf-rig-wall hf-rig-wall-inner-right", deck);
    parts.walls.push(parts.innerLeft, parts.innerRight);
    if (panels === 4) {
      parts.outerLeft = make("div", "hf-rig-wall hf-rig-wall-outer-left", parts.innerLeft);
      parts.outerRight = make("div", "hf-rig-wall hf-rig-wall-outer-right", parts.innerRight);
      parts.walls.push(parts.outerLeft, parts.outerRight);
    }
    if (withFloor) parts.floor = make("div", "hf-rig-floor", deck);
    if (withProps) parts.propsLayer = make("div", "hf-rig-props", deck);
    // Walls and floor are scenery (background track). Diagnostics measure foreground
    // coverage without them; outer walls inherit the mark through their inner parent.
    parts.walls.concat(parts.floor ? [parts.floor] : []).forEach(function (node) {
      node.setAttribute("data-hf-set", "");
    });
    if (layout === "full") layoutFull(root, parts, panels, horizon);
    // Full layout: the backboard stands right on the floor's hinge line, so in one shared 3D
    // context the folding panels cut through the floor. Each panel carries its own lens instead
    // and the deck paints them in DOM order (floor over walls).
    var lens = layout === "full" ? "perspective(1800px) " : "";
    if (layout === "full") deck.style.transformStyle = "flat";

    function propFeet() {
      return root.querySelectorAll("[data-hf-prop-foot]");
    }

    function apply(state) {
      state = state || {};
      var inner = clamp01(state.inner);
      var outer = clamp01(state.outer);
      var floor = clamp01(state.floor);
      var prop = clamp01(state.prop);
      var innerAngle = INNER_FOLD_DEG * (1 - inner);
      var outerAngle = OUTER_FOLD_DEG * (1 - outer);
      parts.innerLeft.style.transform = lens + "rotateY(" + innerAngle + "deg)";
      parts.innerRight.style.transform = lens + "rotateY(" + (-innerAngle) + "deg)";
      if (parts.outerLeft) parts.outerLeft.style.transform = "rotateY(" + (-outerAngle) + "deg)";
      if (parts.outerRight) parts.outerRight.style.transform = "rotateY(" + outerAngle + "deg)";
      if (parts.floor) parts.floor.style.transform = lens + "rotateX(" + (FLOOR_FOLD_DEG * (1 - floor)) + "deg)";
      var propAngle = PROP_FOLD_DEG * (1 - prop);
      var feet = propFeet();
      for (var i = 0; i < feet.length; i += 1) {
        feet[i].style.transform = "rotateX(" + propAngle + "deg)";
      }
    }

    // Skins live in each example's style.css so the two cards stay materially
    // distinct while sharing this one fold mechanism.
    apply({ inner: 0, outer: 0, floor: 0, prop: 0 });

    return {
      root: root,
      deck: deck,
      parts: parts,
      apply: apply,
      refreshProps: propFeet
    };
  }

  // Full-screen layout: the unfolded panels tile the whole width from the top edge down to
  // the horizon, and the floor fills from the horizon to the bottom edge. Nothing else is
  // needed behind the set once it is open.
  function layoutFull(root, parts, panels, horizon) {
    var width = STAGE_WIDTH / panels;
    root.classList.add("hf-rig-full");
    root.style.perspectiveOrigin = "50% " + (horizon / FRAME_HEIGHT * 100).toFixed(2) + "%";
    function box(node, left, top, w, h) {
      node.style.left = left + "px"; node.style.top = top + "px";
      node.style.width = w + "px"; node.style.height = h + "px";
    }
    box(parts.innerLeft, STAGE_WIDTH / 2 - width, 0, width, horizon);
    box(parts.innerRight, STAGE_WIDTH / 2, 0, width, horizon);
    if (parts.outerLeft) box(parts.outerLeft, -width, 0, width, horizon);
    if (parts.outerRight) box(parts.outerRight, width, 0, width, horizon);
    if (parts.floor) {
      box(parts.floor, 0, horizon, STAGE_WIDTH, FRAME_HEIGHT - horizon);
      parts.floor.style.clipPath = "none";
    }
  }

  // ---------- Standard background actions (shared by stage-full and stage-light) ----------
  // A full-screen paper backdrop driven by time: unfold, refold (fold, switch skin, unfold)
  // and fold. Actions are validated when added; apply(t) is a pure function of t.
  var DEFAULT_SKIN = { wall: ["#f7ecd8", "#e6cfa8"], floor: ["#dcbd8e", "#c49a63"] };
  var ACTIONS = {
    unfold: { duration: 2.0, needs: "folded", leaves: "open" },
    refold: { duration: 3.0, needs: "open", leaves: "open" },
    fold: { duration: 1.2, needs: "open", leaves: "folded" }
  };
  function span(p, a, b) { return clamp01((p - a) / (b - a)); }
  function out3(p) { return 1 - Math.pow(1 - p, 3); }
  function inOut(p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }
  function opening(p) {
    return { inner: out3(span(p, 0, 0.325)), floor: out3(span(p, 0.075, 0.425)),
      outer: out3(span(p, 0.225, 0.625)), prop: out3(span(p, 0.65, 1)) };
  }
  function closing(p) {
    var inner = 1 - inOut(span(p, 0.45, 1));
    return { prop: 1 - inOut(span(p, 0, 0.2)), outer: 1 - inOut(span(p, 0.15, 0.55)), inner: inner, floor: inner };
  }
  var OPEN = { inner: 1, outer: 1, floor: 1, prop: 1 };
  var SHUT = { inner: 0, outer: 0, floor: 0, prop: 0 };

  function colours(value, name) {
    if (!Array.isArray(value) || value.length !== 2 || value.some(function (c) { return typeof c !== "string" || !c; })) {
      throw new TypeError("createBackdrop: " + name + " must be two CSS colours [top, bottom]");
    }
    return value.slice();
  }

  function createBackdrop(options) {
    options = options || {};
    Object.keys(options).forEach(function (key) {
      if (["mount", "panels", "horizon", "props", "skins", "skin"].indexOf(key) < 0) throw new TypeError("createBackdrop: unknown option '" + key + "'");
    });
    var skins = {};
    Object.keys(options.skins || { paper: DEFAULT_SKIN }).forEach(function (key) {
      var skin = (options.skins || { paper: DEFAULT_SKIN })[key];
      skins[key] = { wall: colours(skin && skin.wall, key + ".wall"), floor: colours(skin && skin.floor, key + ".floor") };
    });
    var first = options.skin == null ? Object.keys(skins)[0] : options.skin;
    if (!skins[first]) throw new TypeError("createBackdrop: unknown skin '" + first + "'");
    var rig = createPaperStage({ mount: options.mount, panels: options.panels, floor: true,
      props: options.props !== false, layout: "full", horizon: options.horizon, name: "backdrop" });
    var actions = [];
    var painted = null;
    var disposed = false;

    function paint(name) {
      if (painted === name) return;
      painted = name;
      var skin = skins[name];
      rig.parts.walls.forEach(function (node, i) {
        node.style.backgroundImage = "repeating-linear-gradient(90deg, rgba(255,255,255,.34) 0 3px, rgba(0,0,0,0) 3px 64px), " +
          "linear-gradient(180deg, " + skin.wall[0] + ", " + skin.wall[1] + ")";
        node.style.boxShadow = "inset 0 0 0 7px rgba(255,255,255,.9), inset 0 -60px 80px rgba(80,50,20,.14)";
        node.style.filter = i > 1 ? "brightness(0.96)" : "";
      });
      rig.parts.floor.style.backgroundImage = "repeating-linear-gradient(90deg, rgba(90,62,30,.16) 0 2px, rgba(0,0,0,0) 2px 120px), " +
        "linear-gradient(180deg, " + skin.floor[0] + ", " + skin.floor[1] + ")";
      rig.parts.floor.style.boxShadow = "inset 0 8px 0 rgba(255,255,255,.55)";
      rig.root.setAttribute("data-hf-skin", name);
    }

    function check(list) {
      var sorted = list.slice().sort(function (a, b) { return a.at - b.at; });
      var state = sorted.length && sorted[0].kind !== "unfold" ? "open" : "folded";
      for (var i = 0; i < sorted.length; i += 1) {
        var a = sorted[i];
        if (i && a.at < sorted[i - 1].at + sorted[i - 1].duration) throw new TypeError("backdrop: " + a.kind + " at " + a.at + "s overlaps " + sorted[i - 1].kind + " at " + sorted[i - 1].at + "s");
        if (ACTIONS[a.kind].needs !== state) throw new TypeError("backdrop: " + a.kind + " at " + a.at + "s needs the set " + ACTIONS[a.kind].needs + ", but it is " + state);
        state = ACTIONS[a.kind].leaves;
      }
      return sorted;
    }

    function add(kind, config) {
      if (disposed) throw new TypeError("backdrop: disposed");
      config = config || {};
      Object.keys(config).forEach(function (key) {
        if (key !== "at" && key !== "duration" && !(kind === "refold" && key === "skin")) throw new TypeError("backdrop." + kind + ": unknown option '" + key + "'");
      });
      var at = Number(config.at), duration = config.duration == null ? ACTIONS[kind].duration : Number(config.duration);
      if (config.at == null || !Number.isFinite(at) || at < 0) throw new TypeError("backdrop." + kind + ": at must be a time >= 0");
      if (!Number.isFinite(duration) || duration <= 0) throw new TypeError("backdrop." + kind + ": duration must be > 0");
      if (kind === "refold" && !skins[config.skin]) throw new TypeError("backdrop.refold: skin must be one of " + Object.keys(skins).join(", "));
      actions = check(actions.concat([{ kind: kind, at: at, duration: duration, skin: config.skin }]));
      return api;
    }

    function apply(t) {
      if (disposed) return;
      t = Number(t);
      var state = actions.length && actions[0].kind !== "unfold" ? OPEN : SHUT;
      var skin = first;
      for (var i = 0; i < actions.length; i += 1) {
        var a = actions[i];
        if (t < a.at) break;
        var p = clamp01((t - a.at) / a.duration);
        if (a.kind === "unfold") state = opening(p);
        else if (a.kind === "fold") state = closing(p);
        else {
          state = p < 0.42 ? closing(p / 0.42) : p < 0.58 ? SHUT : opening((p - 0.58) / 0.42);
          if (p >= 0.5) skin = a.skin;
        }
      }
      paint(skin);
      rig.apply(state);
    }

    var api = {
      root: rig.root,
      rig: rig,
      unfold: function (config) { return add("unfold", config); },
      refold: function (config) { return add("refold", config); },
      fold: function (config) { return add("fold", config); },
      apply: apply,
      dispose: function () {
        if (disposed) return;
        disposed = true;
        if (rig.root.parentNode) rig.root.parentNode.removeChild(rig.root);
      }
    };
    apply(0);
    return api;
  }

  global.HarnessStageRig = {
    createPaperStage: createPaperStage,
    createBackdrop: createBackdrop,
    WALL_PANEL_WIDTH: WALL_PANEL_WIDTH,
    WALL_PANEL_HEIGHT: WALL_PANEL_HEIGHT,
    WALL_TOP: WALL_TOP,
    FLOOR_DEPTH: FLOOR_DEPTH,
    STAGE_WIDTH: STAGE_WIDTH,
    INNER_FOLD_DEG: INNER_FOLD_DEG,
    OUTER_FOLD_DEG: OUTER_FOLD_DEG,
    FLOOR_FOLD_DEG: FLOOR_FOLD_DEG,
    PROP_FOLD_DEG: PROP_FOLD_DEG
  };
})(window);

/* HarnessStageKit · stage-full 积木核心（卡内资产，随工程装进 runtime/）
 *
 * 积木是「参数进、确定性画面出」的部件：每个积木接一份 options，自己建 DOM、自己注入 CSS，
 * 返回 { root, apply(t), dispose() }。apply(t) 是全片时间 t 的纯函数：任意 seek、倒放、重复 seek
 * 都从 t 重建完整状态。没有 RAF、定时器、Date、Math.random，也不依赖事件回调。
 *
 * 为什么存在：前景轨的执行者可以少写布局与样式，把精力放在本期的物上。常见缺陷——
 * 类名没有 CSS（塌成 static）、容器 visibility:hidden 被子节点继承、折叠装置没有 mount——
 * 在积木里做不出来：积木自己的类名自己注入；节点显隐一律经 kit.shown() 同时写 opacity 与
 * visibility；几何缺参数时直接抛错，不给静默默认值。
 *
 * 用法：
 *   var kit = window.HarnessStageKit;
 *   var block = kit.create('slot.text', { mount: textLayer, ... });   // 见 blocks/*.js 与各自的 .md
 *   var all = kit.compose([block, ...]);
 *   function renderAt(t) { all.apply(t); }                              // 交给 HarnessScene.bindScene
 *
 * 各积木文件在核心之后加载，通过 kit.define(name, factory) 注册；factory(options, kit) 返回积木。
 */
(function (global) {
  "use strict";

  var VERSION = 2;
  var registry = {};
  var styleIds = {};

  // ---------- CSS 注入：每个积木一份，重复调用无副作用 ----------
  function ensureCss(id, text) {
    if (typeof id !== "string" || !id) throw new TypeError("ensureCss requires a style id");
    if (styleIds[id] || document.getElementById(id)) { styleIds[id] = true; return; }
    var style = document.createElement("style");
    style.id = id;
    style.textContent = String(text);
    document.head.appendChild(style);
    styleIds[id] = true;
  }

  // ---------- 时间与缓动：全部是 t 的纯函数 ----------
  function clamp01(value) {
    var number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return 0;
    return number >= 1 ? 1 : number;
  }
  function finite(value, name) {
    var number = Number(value);
    if (!Number.isFinite(number)) throw new TypeError("stage-kit: " + name + " must be a finite number");
    return number;
  }
  var ease = {
    linear: function (p) { return clamp01(p); },
    inOut: function (p) { p = clamp01(p); return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }, // power2.inOut
    out2: function (p) { p = clamp01(p); return 1 - (1 - p) * (1 - p); },                                   // power2.out
    out3: function (p) { p = clamp01(p); return 1 - Math.pow(1 - p, 3); },                                  // power3.out
    inOut3: function (p) { p = clamp01(p); return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }, // power3.inOut
    sineInOut: function (p) { p = clamp01(p); return -(Math.cos(Math.PI * p) - 1) / 2; },
    quintOut: function (p) { p = clamp01(p); return 1 - Math.pow(1 - p, 5); },
    backOut: function (s) {                                                                                   // back.out(s)
      var k = Number.isFinite(Number(s)) ? Number(s) : 1.70158;
      return function (p) { p = clamp01(p); var q = p - 1; return 1 + (k + 1) * q * q * q + k * q * q; };
    }
  };
  // 0→1 的线性斜坡
  function ramp(t, a, b) { return b === a ? (t >= b ? 1 : 0) : clamp01((t - a) / (b - a)); }
  // 从 at 起 dur 秒内按 easeFn 进入；可选从 out 起 outDur 秒内退出。返回 0..1。
  function win(t, at, dur, easeFn, out, outDur) {
    var fn = easeFn || ease.out3;
    var appear = fn(ramp(t, at, at + (dur || 0.45)));
    if (out == null) return appear;
    return appear * (1 - fn(ramp(t, out, out + (outDur || 0.35))));
  }
  // 两段式落定：先 dur1 秒到「冲击」(impact)，再 dur2 秒回到「静止」(rest)。返回 {phase:0|1|2|3, p}。
  function settle(t, at, dur1, dur2) {
    if (t < at) return { phase: 0, p: 0 };
    if (t < at + dur1) return { phase: 1, p: ease.out3(ramp(t, at, at + dur1)) };
    if (t < at + dur1 + dur2) return { phase: 2, p: ease.backOut(2.2)(ramp(t, at + dur1, at + dur1 + dur2)) };
    return { phase: 3, p: 1 };
  }
  function lerp(a, b, p) { return a + (b - a) * p; }

  // ---------- DOM 助手：所有积木节点绝对定位、显隐成对写 ----------
  function make(tag, cls, parent) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (parent) parent.appendChild(node);
    return node;
  }
  function abs(node, box) {
    node.style.position = "absolute";
    if (box) {
      if (box.x != null) node.style.left = finite(box.x, "x") + "px";
      if (box.y != null) node.style.top = finite(box.y, "y") + "px";
      if (box.w != null) node.style.width = finite(box.w, "w") + "px";
      if (box.h != null) node.style.height = finite(box.h, "h") + "px";
    }
    return node;
  }
  // 显隐只走这里：opacity 与 visibility 同时写，子节点不会因为容器 hidden 而消失。
  function shown(node, value) {
    var v = clamp01(value);
    node.style.opacity = v.toFixed(3);
    node.style.visibility = v <= 0.001 ? "hidden" : "visible";
    return v;
  }
  function requireBox(options, keys, name) {
    var out = {};
    (keys || ["x", "y", "w", "h"]).forEach(function (key) {
      if (options == null || options[key] == null) throw new TypeError("stage-kit." + name + ": option '" + key + "' is required");
      out[key] = finite(options[key], key);
    });
    return out;
  }
  function requireNode(node, name, hostLayer) {
    if (!node || node.nodeType !== 1) throw new TypeError("stage-kit." + name + ": 'mount' must be an element");
    if (hostLayer) {
      var host = node.closest("[data-hf-layer]");
      if (!host || host.getAttribute("data-hf-layer") !== hostLayer) {
        throw new TypeError("stage-kit." + name + ": mount must live inside the '" + hostLayer + "' layer host");
      }
    }
    return node;
  }

  // ---------- 注册表 ----------
  function define(name, factory) {
    if (typeof name !== "string" || !/^[a-z]+\.[a-z]+$/.test(name)) throw new TypeError("stage-kit: block name must look like 'group.name'");
    if (typeof factory !== "function") throw new TypeError("stage-kit: factory must be a function");
    if (registry[name]) throw new Error("stage-kit: block already defined: " + name);
    registry[name] = factory;
  }
  // 全屏的层宿主不吃命中测试：否则第 3、4 层宿主盖住整个画面，诊断把台上的物判成被遮挡。
  // :where 零特异性，宿主直接子节点恢复 auto，正常遮挡照算，工程 CSS 仍可覆盖。
  var LAYER_CSS = ":where([data-hf-layer]){pointer-events:none}:where([data-hf-layer])>*{pointer-events:auto}";
  function create(name, options) {
    ensureCss("hf-kit-layer-hosts", LAYER_CSS);
    var factory = registry[name];
    if (!factory) throw new Error("stage-kit: unknown block '" + name + "'; loaded: " + Object.keys(registry).sort().join(", "));
    var block = factory(options || {}, api);
    if (!block || typeof block.apply !== "function" || !block.root || typeof block.dispose !== "function") {
      throw new Error("stage-kit: block '" + name + "' must return { root, apply(t), dispose() }");
    }
    block.name = name;
    return block;
  }
  function compose(blocks) {
    var list = (blocks || []).slice();
    return {
      blocks: list,
      apply: function (t) { for (var i = 0; i < list.length; i += 1) list[i].apply(t); },
      dispose: function () { for (var i = list.length - 1; i >= 0; i -= 1) list[i].dispose(); list.length = 0; }
    };
  }
  function list() { return Object.keys(registry).sort(); }

  var api = {
    VERSION: VERSION,
    ensureCss: ensureCss,
    ease: ease,
    clamp01: clamp01,
    finite: finite,
    ramp: ramp,
    window: win,
    settle: settle,
    lerp: lerp,
    make: make,
    abs: abs,
    shown: shown,
    requireBox: requireBox,
    requireNode: requireNode,
    define: define,
    create: create,
    compose: compose,
    list: list
  };
  global.HarnessStageKit = api;
})(window);

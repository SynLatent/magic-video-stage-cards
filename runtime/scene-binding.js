/* Thin scene-local binding for HyperFrames' upstream hf-seek adapter.
 * Keep this file and all render assets inside the Work project snapshot.
 * timeline is a scene-local paused timeline, not another __timelines entry.
 * The root composition still registers its single upstream master timeline.
 */
(function (global) {
  "use strict";
  function bindScene({ start = 0, duration, timeline, renderAt, ready = Promise.resolve(), dispose = () => {} }) {
    if (!Number.isFinite(start) || start < 0 || !Number.isFinite(duration) || duration <= 0 || typeof renderAt !== "function") {
      throw new TypeError("Scene requires nonnegative start, positive duration and renderAt");
    }
    let disposed = false;
    const assetsReady = Promise.resolve(ready);
    // Every seek sets complete state; no accumulated delta or onUpdate dependency.
    async function seek(time) {
      if (!Number.isFinite(time)) throw new TypeError("Scene time must be finite");
      await assetsReady;
      if (disposed) return;
      const localTime = Math.max(0, Math.min(duration, time - start));
      timeline?.totalTime(localTime, true);
      await renderAt(localTime);
    }
    function onSeek(event) {
      const pending = seek(event.detail.time);
      if (typeof event.detail.waitUntil === "function") event.detail.waitUntil(pending);
      else pending.catch(error => { global.dispatchEvent(new ErrorEvent("error", { error, message: error.message })); });
    }
    global.addEventListener("hf-seek", onSeek);
    return {
      ready: assetsReady,
      seek,
      dispose() {
        if (disposed) return;
        disposed = true;
        global.removeEventListener("hf-seek", onSeek);
        timeline?.kill();
        dispose();
      },
    };
  }
  function bindExplainer({ duration, captions, background, figures, ready, renderAt = () => {} }) {
    const bindings = [background, figures, captions].filter(Boolean);
    return bindScene({ start: 0, duration, ready,
      async renderAt(t) { for (const binding of bindings) await binding.renderAt(t); await renderAt(t); },
      dispose() { for (const binding of bindings) binding.dispose(); },
    });
  }
  global.HarnessScene = { bindScene, bindExplainer };
})(window);

import { useEffect } from "react";
import { clamp, sdRoundedRect } from "../glass/roundedRectField.js";
import {
  approach,
  computeTraces,
  followAxis,
  layerPresence,
  stepSpring,
} from "../glass/liquidField.js";
import { readLiquidColours } from "../glass/liquidColours.js";
import { LiquidLayerPool } from "../glass/liquidGlassGL.js";

/*
 * Drives the prototype with the pointer model the app will use: a smoothed
 * pointer for the lamp, a springier anchor for the liquid trace, and a pool of
 * four WebGL layers for the surfaces nearest the pointer. Settings are read
 * from a ref every frame, so moving a slider never recreates a WebGL context.
 * While `pinRef` holds a point, the pointer stays there so slider changes can
 * be watched.
 */
export function useLiquidDemo({ stageRef, settingsRef, debugRef, invalidateRef, statsRef, pinRef }) {
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    const pool = new LiquidLayerPool(4);
    const states = new Map();
    const pointer = {
      active: false,
      positioned: false,
      x: { value: 0, velocity: 0 },
      y: { value: 0, velocity: 0 },
      anchorX: { value: 0, velocity: 0 },
      anchorY: { value: 0, velocity: 0 },
      targetX: 0,
      targetY: 0,
    };
    const timing = { total: 0, frames: 0, last: 0 };
    let colours = readLiquidColours(stage);
    let frame = null;
    let lastTime = 0;
    let measurementsDirty = true;

    function requestFrame() {
      if (frame === null) frame = requestAnimationFrame(render);
    }

    function markMeasurementsDirty() {
      measurementsDirty = true;
      requestFrame();
    }

    function moveTo(x, y) {
      pointer.targetX = x;
      pointer.targetY = y;
      pointer.active = true;
      if (!pointer.positioned) {
        for (const [axis, value] of [[pointer.x, x], [pointer.y, y], [pointer.anchorX, x], [pointer.anchorY, y]]) {
          axis.value = value;
          axis.velocity = 0;
        }
        pointer.positioned = true;
      }
    }

    function measure() {
      const seen = new Set();
      for (const element of stage.querySelectorAll("[data-liquid-surface]")) {
        let state = states.get(element);
        if (!state) {
          state = { element, presence: 0 };
          states.set(element, state);
        }
        const rect = element.getBoundingClientRect();
        // The canvas fills the padding box, so measure from inside the border.
        state.left = rect.left + element.clientLeft;
        state.top = rect.top + element.clientTop;
        state.width = element.clientWidth;
        state.height = element.clientHeight;
        state.radius = Math.max(
          0,
          parseFloat(getComputedStyle(element).borderTopLeftRadius) - element.clientLeft,
        );
        seen.add(element);
      }
      for (const element of states.keys()) {
        if (!seen.has(element)) states.delete(element);
      }
      measurementsDirty = false;
    }

    function reportStats(now, started) {
      timing.total += performance.now() - started;
      timing.frames += 1;
      if (now - timing.last < 500 || !statsRef.current) return;
      const layers = pool.slots.filter((slot) => slot.key !== null);
      const sizes = layers.map((slot) => `${slot.layer.canvas.width}×${slot.layer.canvas.height}`);
      statsRef.current.textContent = pool.failed
        ? "WebGL is unavailable, so the liquid layer is off."
        : `${(timing.total / timing.frames).toFixed(2)} ms per frame (CPU) · ` +
          `${layers.length} canvas${layers.length === 1 ? "" : "es"}` +
          (sizes.length ? ` · ${sizes.join(", ")} px` : "");
      timing.total = 0;
      timing.frames = 0;
      timing.last = now;
    }

    function render(now) {
      frame = null;
      const started = performance.now();
      const delta = lastTime ? clamp((now - lastTime) / 1000, 1 / 240, 0.06) : 1 / 60;
      lastTime = now;
      if (measurementsDirty) measure();
      const settings = settingsRef.current;
      if (pinRef.current) moveTo(pinRef.current.x, pinRef.current.y);

      followAxis(pointer.x, pointer.targetX, 0.085, delta);
      followAxis(pointer.y, pointer.targetY, 0.085, delta);
      const anchorMovingX = stepSpring(
        pointer.anchorX, pointer.targetX, settings.springStiffness, settings.springDamping, delta,
      );
      const anchorMovingY = stepSpring(
        pointer.anchorY, pointer.targetY, settings.springStiffness, settings.springDamping, delta,
      );
      const x = pointer.x.value;
      const y = pointer.y.value;
      let moving = anchorMovingX || anchorMovingY || x !== pointer.targetX || y !== pointer.targetY;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, settings.pixelRatio);
      const requests = [];

      for (const state of states.values()) {
        if (!state.width || !state.height) continue;
        const localX = x - state.left;
        const localY = y - state.top;
        const distance = sdRoundedRect(
          localX - state.width / 2,
          localY - state.height / 2,
          state.width,
          state.height,
          state.radius,
        );
        const presence = pointer.active ? layerPresence(distance, settings.presence) : 0;
        state.presence = approach(state.presence, presence, 12, delta);
        moving ||= state.presence !== presence;

        if (state.presence > 0.001) {
          const traces = computeTraces(
            pointer.anchorX.value - state.left,
            pointer.anchorY.value - state.top,
            state.width,
            state.height,
            state.radius,
            settings,
            state.presence,
          );
          requests.push({
            key: state.element,
            element: state.element,
            width: state.width,
            height: state.height,
            pixelRatio,
            priority: state.presence,
            values: {
              ...settings,
              radius: state.radius,
              cursor: [localX, localY],
              traceFrame: traces.frame,
              traceShape: traces.shape,
              swellPoints: traces.swellPoints,
              traceSwells: traces.swells,
              lightColor: colours.light,
              shadeColor: colours.shade,
              opacity: state.presence,
            },
          });
        }
      }

      requests.sort((a, b) => b.priority - a.priority);
      const fading = pool.sync(requests, delta, debugRef.current);
      reportStats(now, started);
      if (moving || fading) requestFrame();
      else lastTime = 0;
    }

    function handlePointerMove(event) {
      if (event.pointerType === "touch" || pinRef.current) return;
      moveTo(event.clientX, event.clientY);
      requestFrame();
    }

    function handlePointerLeave() {
      if (pinRef.current) return;
      pointer.active = false;
      pointer.positioned = false;
      requestFrame();
    }

    invalidateRef.current = ({ theme = false } = {}) => {
      if (theme) colours = readLiquidColours(stage);
      requestFrame();
    };
    const resizeObserver = new ResizeObserver(markMeasurementsDirty);
    resizeObserver.observe(stage);
    const root = document.documentElement;
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    root.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("blur", handlePointerLeave);
    window.addEventListener("resize", markMeasurementsDirty, { passive: true });
    window.addEventListener("scroll", markMeasurementsDirty, { capture: true, passive: true });
    requestFrame();

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      invalidateRef.current = () => {};
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      root.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("blur", handlePointerLeave);
      window.removeEventListener("resize", markMeasurementsDirty);
      window.removeEventListener("scroll", markMeasurementsDirty, true);
      pool.destroy();
    };
  }, [stageRef, settingsRef, debugRef, invalidateRef, statsRef, pinRef]);
}

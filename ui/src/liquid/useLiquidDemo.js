import { useEffect } from "react";
import { clamp, sdRoundedRect, smoothstep } from "../glass/roundedRectField.js";
import {
  approach,
  followAxis,
  layerPresence,
  pressStrength,
  stepSpring,
} from "../glass/liquidField.js";
import { readLiquidColours } from "../glass/liquidColours.js";
import { LiquidLayerPool } from "../glass/liquidGlassGL.js";

/*
 * Drives the prototype with the pointer model the app will use: a smoothed
 * pointer, a springy dent per surface, and a pool of two WebGL layers for the
 * surfaces nearest the pointer. Settings are read from a ref every frame, so
 * moving a slider never recreates a WebGL context.
 */
export function useLiquidDemo({ stageRef, settingsRef, debugRef, invalidateRef, statsRef }) {
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    const pool = new LiquidLayerPool(2);
    const states = new Map();
    const pointer = {
      active: false,
      positioned: false,
      x: { value: 0, velocity: 0 },
      y: { value: 0, velocity: 0 },
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

    function measure() {
      const seen = new Set();
      for (const element of stage.querySelectorAll("[data-liquid-surface]")) {
        let state = states.get(element);
        if (!state) {
          state = { element, dent: { value: 0, velocity: 0 }, presence: 0, face: 0, cache: new Map() };
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

    function writeVariable(state, name, value) {
      if (state.cache.get(name) !== value) {
        state.cache.set(name, value);
        state.element.style.setProperty(name, value);
      }
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

      followAxis(pointer.x, pointer.targetX, 0.085, delta);
      followAxis(pointer.y, pointer.targetY, 0.085, delta);
      const x = pointer.x.value;
      const y = pointer.y.value;
      const speed = Math.hypot(pointer.x.velocity, pointer.y.velocity);
      const stretchAmount = clamp(speed / 2400, 0, 1) * settings.stretch;
      const stretch = speed > 1
        ? [(pointer.x.velocity / speed) * stretchAmount, (pointer.y.velocity / speed) * stretchAmount]
        : [0, 0];
      const pixelRatio = Math.min(window.devicePixelRatio || 1, settings.pixelRatio);
      let moving = x !== pointer.targetX || y !== pointer.targetY;
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

        const press = pointer.active ? pressStrength(distance, settings.reach, settings.outsideReach) : 0;
        moving = stepSpring(state.dent, press, settings.springStiffness, settings.springDamping, delta) ||
          moving;
        const presence = pointer.active ? layerPresence(distance, settings.presence) : 0;
        state.presence = approach(state.presence, presence, 12, delta);

        // The existing soft face glow stays; its rim parts are left off
        // (--lg-edge stays 0) because the canvas lights the rim now.
        const face = pointer.active ? 1 - smoothstep(0, 220, Math.max(0, distance)) : 0;
        state.face = approach(state.face, face, 12, delta);
        moving ||= state.presence !== presence || state.face !== face;
        writeVariable(state, "--lg-active", state.face.toFixed(4));
        writeVariable(state, "--lg-local-x", `${localX.toFixed(1)}px`);
        writeVariable(state, "--lg-local-y", `${localY.toFixed(1)}px`);
        writeVariable(state, "--lg-mirror-x", `${(state.width - localX).toFixed(1)}px`);
        writeVariable(state, "--lg-mirror-y", `${(state.height - localY).toFixed(1)}px`);

        if (state.presence > 0.001 || Math.abs(state.dent.value) > 0.001) {
          requests.push({
            key: state.element,
            element: state.element,
            width: state.width,
            height: state.height,
            pixelRatio,
            priority: state.presence,
            values: {
              radius: state.radius,
              cursor: [localX, localY],
              stretch,
              amount: Math.max(0, state.dent.value),
              dentRadius: settings.dentRadius,
              dentDepth: settings.dentDepth,
              dentSoftness: settings.dentSoftness,
              neck: settings.neck,
              bevel: settings.bevel,
              bevelHeight: settings.bevelHeight,
              lightHeight: settings.lightHeight,
              falloff: settings.falloff,
              glow: settings.glow,
              specular: settings.specular,
              shininess: settings.shininess,
              shade: settings.shade,
              caustic: settings.caustic,
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
      if (event.pointerType === "touch") return;
      pointer.targetX = event.clientX;
      pointer.targetY = event.clientY;
      pointer.active = true;
      if (!pointer.positioned) {
        pointer.x.value = event.clientX;
        pointer.y.value = event.clientY;
        pointer.positioned = true;
      }
      requestFrame();
    }

    function handlePointerLeave() {
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
  }, [stageRef, settingsRef, debugRef, invalidateRef, statsRef]);
}

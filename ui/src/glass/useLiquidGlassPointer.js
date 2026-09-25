import { useEffect } from "react";
import { clamp, sdRoundedRect, smoothstep } from "./roundedRectField.js";
import {
  LIQUID_DEFAULTS,
  approach,
  computeTraces,
  followAxis,
  layerPresence,
  stepSpring,
} from "./liquidField.js";
import { readLiquidColours } from "./liquidColours.js";
import { LiquidLayerPool } from "./liquidGlassGL.js";

/*
 * The pointer acts as a small lamp held just above the page, and nothing is
 * drawn at the pointer itself. Where WebGL is available, the glass nearest it
 * is lit per pixel by the liquid layer (liquidGlassGL.js): the rim swells and
 * sends a liquid trace towards the pointer. Without WebGL, the CSS rim light
 * in liquidGlass.css takes over: a highlight on the border ring, lit from the
 * pointer's own position so it never jumps between edges.
 */
const SETTINGS = LIQUID_DEFAULTS;
// Enough layers for every surface around a gap between cards, so a surface
// that stops being among the nearest always fades out on its own layer
// instead of having it taken over mid-fade.
const LIQUID_LAYERS = 4;
// How far from the rim the CSS rim light still shows.
const RIM_REACH = 210;

function writeVariable(surface, name, value) {
  surface.styleValueCache ??= new Map();
  if (surface.styleValueCache.get(name) !== value) {
    surface.styleValueCache.set(name, value);
    surface.element.style.setProperty(name, value);
  }
}

function resetSurface(surface) {
  surface.presence = 0;
  surface.edge = 0;
  writeVariable(surface, "--lg-edge", "0");
}

function whenIdle(callback) {
  if ("requestIdleCallback" in window) {
    const handle = window.requestIdleCallback(callback, { timeout: 2000 });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(callback, 500);
  return () => window.clearTimeout(handle);
}

export function useLiquidGlassPointer({
  groupRef,
  surfacesRef,
  resizeObserverRef,
  markMeasurementsDirtyRef,
  enabled = true,
  spillRadius = 220,
  maxActiveSurfaces = 6,
}) {
  useEffect(() => {
    const group = groupRef.current;
    const surfaces = surfacesRef.current;
    if (!group) return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const forcedColors = window.matchMedia("(forced-colors: active)");
    const radius = Math.max(1, Number(spillRadius) || 220);
    const surfaceLimit = clamp(Math.floor(Number(maxActiveSurfaces) || 0), 0, 12);
    const pool = new LiquidLayerPool(LIQUID_LAYERS);
    const pointer = {
      active: false,
      positioned: false,
      x: { value: 0, velocity: 0 },
      y: { value: 0, velocity: 0 },
      // The liquid follows on a springier path than the light, so it lags and
      // overshoots a little.
      anchorX: { value: 0, velocity: 0 },
      anchorY: { value: 0, velocity: 0 },
      targetX: 0,
      targetY: 0,
    };
    let colours = null;
    let available = false;
    let frame = null;
    let lastTime = 0;
    let measurementsDirty = true;
    let cancelPrewarm = null;

    function requestFrame() {
      if (available && frame === null) frame = requestAnimationFrame(render);
    }

    function markMeasurementsDirty() {
      measurementsDirty = true;
      if (pointer.active) requestFrame();
    }

    function measureSurfaces() {
      // Batch layout reads before any per-frame style writes.
      for (const surface of surfaces.values()) {
        const { element } = surface;
        if (!element.isConnected) continue;
        const rect = element.getBoundingClientRect();
        surface.rect = rect;
        // Highlights are drawn in the surface's own pixels, which differ from
        // viewport pixels while an ancestor is scaled (e.g. a modal opening).
        surface.scaleX = rect.width / (element.offsetWidth || rect.width || 1);
        surface.scaleY = rect.height / (element.offsetHeight || rect.height || 1);
        // The liquid layer and the rim light both work in the padding box.
        surface.borderLeft = element.clientLeft;
        surface.borderTop = element.clientTop;
        surface.innerWidth = element.clientWidth;
        surface.innerHeight = element.clientHeight;
      }
      measurementsDirty = false;
    }

    function toLocal(surface, x, y) {
      return [
        (x - surface.rect.left) / (surface.scaleX || 1) - surface.borderLeft,
        (y - surface.rect.top) / (surface.scaleY || 1) - surface.borderTop,
      ];
    }

    // What is actually under the pointer, and the topmost open dialog, if any.
    function hitTest(x, y) {
      const dialogs = group.querySelectorAll('[aria-modal="true"]');
      return { hit: document.elementFromPoint(x, y), dialog: dialogs[dialogs.length - 1] ?? null };
    }

    // Surfaces hidden behind something else stay dark: everything outside an
    // open dialog, and a surface under the pointer that is covered there.
    function isExposed(surface, scope, x, y) {
      if (scope.dialog && !scope.dialog.contains(surface.element)) return false;
      const { rect } = surface;
      const over = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      return !over || !scope.hit || surface.element.contains(scope.hit);
    }

    // Where the pointer is in a surface's padding box, and its signed distance
    // from the rim (negative inside); null when the surface is out of reach.
    function locate(surface, x, y, scope) {
      const { rect } = surface;
      if (!rect || !surface.element.isConnected || surface.interactive === false ||
        !surface.innerWidth || !surface.innerHeight ||
        x < rect.left - radius || x > rect.right + radius ||
        y < rect.top - radius || y > rect.bottom + radius ||
        !isExposed(surface, scope, x, y)) return null;
      const width = surface.innerWidth;
      const height = surface.innerHeight;
      const cornerRadius = Math.max(0, surface.radius - surface.borderLeft);
      const [localX, localY] = toLocal(surface, x, y);
      const distance = sdRoundedRect(localX - width / 2, localY - height / 2, width, height, cornerRadius);
      return { localX, localY, width, height, cornerRadius, distance };
    }

    function reset() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      lastTime = 0;
      pointer.active = false;
      pointer.positioned = false;
      for (const axis of [pointer.x, pointer.y, pointer.anchorX, pointer.anchorY]) axis.velocity = 0;
      pool.hide();
      for (const surface of surfaces.values()) resetSurface(surface);
    }

    function syncAvailability() {
      available = Boolean(
        enabled && finePointer.matches && !reducedMotion.matches &&
        !forcedColors.matches && document.visibilityState !== "hidden",
      );
      if (!available) reset();
      else if (!cancelPrewarm) cancelPrewarm = whenIdle(() => pool.prewarm());
      measurementsDirty = true;
    }

    function handlePointerMove(event) {
      if (!available || event.pointerType === "touch") return;
      pointer.targetX = event.clientX;
      pointer.targetY = event.clientY;
      pointer.active = true;
      if (!pointer.positioned) {
        pointer.x.value = pointer.anchorX.value = event.clientX;
        pointer.y.value = pointer.anchorY.value = event.clientY;
        pointer.positioned = true;
      }
      measurementsDirty = true;
      requestFrame();
    }

    function handlePointerLeave() {
      pointer.active = false;
      requestFrame();
    }

    // The liquid layer on the surfaces nearest the pointer. Returns true while
    // anything is still fading.
    function renderLiquid(x, y, delta, scope) {
      colours ??= readLiquidColours(group);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, SETTINGS.pixelRatio);
      const requests = [];
      let settling = false;
      // The trace belongs to the surface actually under the pointer: over a
      // glass surface nested inside another, the outer one keeps its rim light
      // but hands the trace to the inner one.
      const underPointer = scope.hit?.closest(".liquid-glass-surface") ?? null;

      for (const surface of surfaces.values()) {
        const spot = pointer.active ? locate(surface, x, y, scope) : null;
        const target = spot ? layerPresence(spot.distance, radius) : 0;
        surface.presence = approach(surface.presence ?? 0, target, 12, delta);
        settling ||= surface.presence !== target;
        const handsOver = Boolean(underPointer) && underPointer !== surface.element &&
          surface.element.contains(underPointer);
        surface.traceShare = approach(surface.traceShare ?? 1, handsOver ? 0 : 1, 12, delta);
        settling ||= surface.traceShare !== (handsOver ? 0 : 1);
        if (!spot || surface.presence <= 0.001) continue;

        const strength = clamp(Number(surface.intensity) || 0, 0, 1.5);
        const tuned = {
          ...SETTINGS,
          glow: SETTINGS.glow * strength,
          specular: SETTINGS.specular * strength,
          traceStrength: SETTINGS.traceStrength * strength,
          swell: SETTINGS.swell * strength,
        };
        // An edge-only surface keeps just the darker line along its edge,
        // which still strengthens as the rim swells near the pointer; every
        // source of white light is switched off.
        if (surface.edgeOnly) {
          Object.assign(tuned, { glow: 0, specular: 0, caustic: 0, traceStrength: 0 });
        }
        const [anchorX, anchorY] = toLocal(surface, pointer.anchorX.value, pointer.anchorY.value);
        const traces = computeTraces(
          anchorX, anchorY, spot.width, spot.height, spot.cornerRadius, tuned, surface.presence,
          surface.presence * surface.traceShare,
        );
        requests.push({
          key: surface.element,
          element: surface.element,
          width: spot.width,
          height: spot.height,
          pixelRatio,
          priority: surface.presence,
          values: {
            ...tuned,
            radius: spot.cornerRadius,
            cursor: [spot.localX, spot.localY],
            traceFrame: traces.frame,
            traceShape: traces.shape,
            swellPoints: traces.swellPoints,
            traceSwells: traces.swells,
            lightColor: colours.light,
            shadeColor: colours.shade,
            opacity: surface.presence,
          },
        });
      }

      requests.sort((a, b) => b.priority - a.priority);
      settling = pool.sync(requests, delta) || settling;
      // A lost context hands over to the CSS rim light from the next frame on.
      return pool.failed || settling;
    }

    // The CSS rim light, used when WebGL is unavailable. Returns true while it
    // is still easing.
    function renderRimLight(x, y, delta, scope) {
      const candidates = [];
      if (pointer.active) {
        for (const surface of surfaces.values()) {
          const spot = locate(surface, x, y, scope);
          if (!spot) continue;
          const proximity = 1 - smoothstep(0, RIM_REACH, Math.abs(spot.distance));
          if (proximity > 0) candidates.push({ surface, spot, proximity });
        }
      }
      candidates.sort((a, b) => b.proximity - a.proximity);
      const active = new Map(candidates.slice(0, surfaceLimit).map((item) => [item.surface.id, item]));
      let settling = false;

      for (const surface of surfaces.values()) {
        const candidate = active.get(surface.id);
        if (!candidate && !surface.edge) continue;
        const strength = clamp(Number(surface.intensity) || 0, 0, 1.5);
        // This fallback only has a white rim light, which edge-only surfaces
        // do without.
        const target = candidate && !surface.edgeOnly ? candidate.proximity * strength : 0;
        if (candidate) {
          const { spot } = candidate;
          writeVariable(surface, "--lg-local-x", `${spot.localX.toFixed(1)}px`);
          writeVariable(surface, "--lg-local-y", `${spot.localY.toFixed(1)}px`);
          writeVariable(surface, "--lg-distance", `${Math.abs(spot.distance).toFixed(1)}px`);
          // Light that enters the near rim reflects off the inside of the far
          // one, at the pointer's reflection through the surface's centre.
          writeVariable(surface, "--lg-mirror-x", `${(spot.width - spot.localX).toFixed(1)}px`);
          writeVariable(surface, "--lg-mirror-y", `${(spot.height - spot.localY).toFixed(1)}px`);
        }
        surface.edge = approach(surface.edge ?? 0, target, 12, delta);
        settling ||= surface.edge !== target;
        writeVariable(surface, "--lg-edge", surface.edge.toFixed(4));
      }
      return settling;
    }

    function render(now) {
      frame = null;
      if (!available) return;
      const delta = lastTime ? clamp((now - lastTime) / 1000, 1 / 240, 0.06) : 1 / 60;
      lastTime = now;
      if (measurementsDirty) measureSurfaces();

      followAxis(pointer.x, pointer.targetX, 0.085, delta);
      followAxis(pointer.y, pointer.targetY, 0.085, delta);
      const anchorMovingX = stepSpring(
        pointer.anchorX, pointer.targetX, SETTINGS.springStiffness, SETTINGS.springDamping, delta,
      );
      const anchorMovingY = stepSpring(
        pointer.anchorY, pointer.targetY, SETTINGS.springStiffness, SETTINGS.springDamping, delta,
      );
      const x = pointer.x.value;
      const y = pointer.y.value;

      const scope = pointer.active ? hitTest(x, y) : { hit: null, dialog: null };
      const surfacesSettling = pool.failed
        ? renderRimLight(x, y, delta, scope)
        : renderLiquid(x, y, delta, scope);
      const pointerSettling = anchorMovingX || anchorMovingY ||
        x !== pointer.targetX || y !== pointer.targetY;
      // A stationary pointer keeps its highlights without spending frames.
      if (pointerSettling || surfacesSettling) requestFrame();
      else {
        lastTime = 0;
        if (!pointer.active) pointer.positioned = false;
      }
    }

    markMeasurementsDirtyRef.current = markMeasurementsDirty;
    const resizeObserver = new ResizeObserver(markMeasurementsDirty);
    resizeObserverRef.current = resizeObserver;
    resizeObserver.observe(group);
    for (const surface of surfaces.values()) {
      resizeObserver.observe(surface.element);
      resetSurface(surface);
    }
    // Refresh coordinates after content changes, scroll, and page transitions.
    const mutationObserver = new MutationObserver(markMeasurementsDirty);
    mutationObserver.observe(group, { childList: true, subtree: true });
    // The liquid layer's colours come from the theme; read them again when it
    // changes, and on every frame of the theme fade, which restyles <html>.
    const themeObserver = new MutationObserver(() => {
      colours = null;
      requestFrame();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "style"],
    });
    group.addEventListener("pointerenter", handlePointerMove, { passive: true });
    group.addEventListener("pointermove", handlePointerMove, { passive: true });
    group.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    group.addEventListener("pointercancel", handlePointerLeave, { passive: true });
    group.addEventListener("transitionend", markMeasurementsDirty);
    group.addEventListener("animationend", markMeasurementsDirty);
    window.addEventListener("blur", reset);
    window.addEventListener("resize", markMeasurementsDirty, { passive: true });
    window.addEventListener("scroll", markMeasurementsDirty, { capture: true, passive: true });
    window.visualViewport?.addEventListener("resize", markMeasurementsDirty, { passive: true });
    document.addEventListener("visibilitychange", syncAvailability);
    for (const query of [reducedMotion, finePointer, forcedColors]) {
      query.addEventListener("change", syncAvailability);
    }
    syncAvailability();

    return () => {
      reset();
      cancelPrewarm?.();
      pool.destroy();
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      themeObserver.disconnect();
      resizeObserverRef.current = null;
      markMeasurementsDirtyRef.current = () => {};
      group.removeEventListener("pointerenter", handlePointerMove);
      group.removeEventListener("pointermove", handlePointerMove);
      group.removeEventListener("pointerleave", handlePointerLeave);
      group.removeEventListener("pointercancel", handlePointerLeave);
      group.removeEventListener("transitionend", markMeasurementsDirty);
      group.removeEventListener("animationend", markMeasurementsDirty);
      window.removeEventListener("blur", reset);
      window.removeEventListener("resize", markMeasurementsDirty);
      window.removeEventListener("scroll", markMeasurementsDirty, true);
      window.visualViewport?.removeEventListener("resize", markMeasurementsDirty);
      document.removeEventListener("visibilitychange", syncAvailability);
      for (const query of [reducedMotion, finePointer, forcedColors]) {
        query.removeEventListener("change", syncAvailability);
      }
    };
  }, [enabled, groupRef, surfacesRef, resizeObserverRef,
    markMeasurementsDirtyRef, spillRadius, maxActiveSurfaces]);
}

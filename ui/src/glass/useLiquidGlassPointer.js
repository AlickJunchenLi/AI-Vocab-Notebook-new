import { useEffect } from "react";
import { clamp, computeSurfaceMetrics, smoothstep } from "./roundedRectField.js";

// The pointer acts as a small lamp held just above the page. Nothing is drawn
// at the pointer itself; nearby glass surfaces catch the light on their rims.
const RIM_REACH = 210;
const SPECULAR_MIN = 54;
const SPECULAR_MAX = 210;

function approach(current, target, rate, delta, epsilon = 0.001) {
  const next = current + (target - current) * (1 - Math.exp(-rate * delta));
  return Math.abs(next - target) < epsilon ? target : next;
}

// Critically damped spring: the light eases in and out of motion instead of
// snapping to each pointer event, which is what makes the rims feel fluid.
function springAxis(axis, target, smoothTime, delta) {
  const omega = 2 / smoothTime;
  const x = omega * delta;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = axis.value - target;
  const carry = (axis.velocity + omega * change) * delta;
  axis.velocity = (axis.velocity - omega * carry) * decay;
  axis.value = target + (change + carry) * decay;
  if (Math.abs(axis.value - target) < 0.05 && Math.abs(axis.velocity) < 2) {
    axis.value = target;
    axis.velocity = 0;
  }
}

function writeVariable(surface, name, value) {
  surface.styleValueCache ??= new Map();
  if (surface.styleValueCache.get(name) !== value) {
    surface.styleValueCache.set(name, value);
    surface.element.style.setProperty(name, value);
  }
}

function resetSurface(surface) {
  surface.render = null;
  writeVariable(surface, "--lg-active", "0");
  writeVariable(surface, "--lg-edge", "0");
}

function createRenderState(metrics) {
  return {
    active: 0,
    edge: 0,
    normalX: metrics.normalX,
    normalY: metrics.normalY,
    specular: SPECULAR_MAX,
  };
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
    const pointer = {
      active: false,
      positioned: false,
      x: { value: 0, velocity: 0 },
      y: { value: 0, velocity: 0 },
      targetX: 0,
      targetY: 0,
    };
    let available = false;
    let frame = null;
    let lastTime = 0;
    let measurementsDirty = true;

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
        if (surface.element.isConnected) {
          const rect = surface.element.getBoundingClientRect();
          surface.rect = rect;
          // Highlights are drawn in the surface's own pixels, which differ from
          // viewport pixels while an ancestor is scaled (e.g. a modal opening).
          surface.scaleX = rect.width / (surface.element.offsetWidth || rect.width || 1);
          surface.scaleY = rect.height / (surface.element.offsetHeight || rect.height || 1);
        }
      }
      measurementsDirty = false;
    }

    function reset() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      lastTime = 0;
      pointer.active = false;
      pointer.positioned = false;
      pointer.x.velocity = 0;
      pointer.y.velocity = 0;
      for (const surface of surfaces.values()) resetSurface(surface);
    }

    function syncAvailability() {
      available = Boolean(
        enabled && finePointer.matches && !reducedMotion.matches &&
        !forcedColors.matches && document.visibilityState !== "hidden",
      );
      if (!available) reset();
      measurementsDirty = true;
    }

    function handlePointerMove(event) {
      if (!available || event.pointerType === "touch") return;
      pointer.targetX = event.clientX;
      pointer.targetY = event.clientY;
      pointer.active = true;
      if (!pointer.positioned) {
        pointer.x.value = event.clientX;
        pointer.y.value = event.clientY;
        pointer.positioned = true;
      }
      measurementsDirty = true;
      requestFrame();
    }

    function handlePointerLeave() {
      pointer.active = false;
      requestFrame();
    }

    function render(now) {
      frame = null;
      if (!available) return;
      const delta = lastTime ? clamp((now - lastTime) / 1000, 1 / 240, 0.06) : 1 / 60;
      lastTime = now;
      if (measurementsDirty) measureSurfaces();

      springAxis(pointer.x, pointer.targetX, 0.085, delta);
      springAxis(pointer.y, pointer.targetY, 0.085, delta);
      const x = pointer.x.value;
      const y = pointer.y.value;
      // A moving highlight smears a little along the rim, like it does on real glass.
      const speed = Math.hypot(pointer.x.velocity, pointer.y.velocity);
      const smear = 1 + clamp(speed / 2600, 0, 0.45);

      const candidates = [];
      if (pointer.active) {
        for (const surface of surfaces.values()) {
          const rect = surface.rect;
          if (!rect || !surface.element.isConnected || surface.interactive === false ||
            rect.width === 0 || rect.height === 0 ||
            x < rect.left - radius || x > rect.right + radius ||
            y < rect.top - radius || y > rect.bottom + radius) continue;

          const scale = ((surface.scaleX || 1) + (surface.scaleY || 1)) / 2;
          const metrics = computeSurfaceMetrics(x, y, rect, surface.radius * scale);
          const proximity = 1 - smoothstep(0, radius, Math.max(0, metrics.d));
          if (proximity > 0) candidates.push({ surface, metrics, proximity });
        }
      }
      candidates.sort((a, b) => b.proximity - a.proximity || Math.abs(a.metrics.d) - Math.abs(b.metrics.d));
      const active = new Map(candidates.slice(0, surfaceLimit).map((item) => [item.surface.id, item]));
      let surfacesSettling = false;

      for (const surface of surfaces.values()) {
        const candidate = active.get(surface.id);
        if (!candidate && !surface.render) continue;

        const current = surface.render ?? createRenderState(candidate.metrics);
        const strength = clamp(Number(surface.intensity) || 0, 0, 1.5);
        let targetActive = 0;
        let targetEdge = 0;

        if (candidate) {
          const { metrics } = candidate;
          const scaleX = surface.scaleX || 1;
          const scaleY = surface.scaleY || 1;
          const distance = Math.abs(metrics.d) / ((scaleX + scaleY) / 2);
          targetActive = candidate.proximity * strength;
          targetEdge = (1 - smoothstep(0, RIM_REACH, distance)) * strength;
          // The rim highlight tightens as the light nears the edge.
          const targetSpecular = clamp(SPECULAR_MIN + distance * 0.62, SPECULAR_MIN, SPECULAR_MAX) * smear;
          // Ease the facing direction so crossing the middle of a narrow surface
          // swings the bevel light across instead of flipping it.
          current.normalX = approach(current.normalX, metrics.normalX, 11, delta);
          current.normalY = approach(current.normalY, metrics.normalY, 11, delta);
          current.specular = approach(current.specular, targetSpecular, 14, delta, 0.05);
          surfacesSettling ||= current.normalX !== metrics.normalX ||
            current.normalY !== metrics.normalY || current.specular !== targetSpecular;

          writeVariable(surface, "--lg-local-x", `${(metrics.elementX / scaleX).toFixed(1)}px`);
          writeVariable(surface, "--lg-local-y", `${(metrics.elementY / scaleY).toFixed(1)}px`);
          writeVariable(surface, "--lg-boundary-x", `${(metrics.boundaryX / scaleX).toFixed(1)}px`);
          writeVariable(surface, "--lg-boundary-y", `${(metrics.boundaryY / scaleY).toFixed(1)}px`);
          // Light that enters the near rim reflects off the inside of the far one.
          writeVariable(surface, "--lg-mirror-x",
            `${((metrics.rectWidth - metrics.boundaryX) / scaleX).toFixed(1)}px`);
          writeVariable(surface, "--lg-mirror-y",
            `${((metrics.rectHeight - metrics.boundaryY) / scaleY).toFixed(1)}px`);
          writeVariable(surface, "--lg-normal-x", current.normalX.toFixed(3));
          writeVariable(surface, "--lg-normal-y", current.normalY.toFixed(3));
          writeVariable(surface, "--lg-specular", `${current.specular.toFixed(1)}px`);
        }

        current.active = approach(current.active, targetActive, 12, delta);
        current.edge = approach(current.edge, targetEdge, 12, delta);
        surfacesSettling ||= current.active !== targetActive || current.edge !== targetEdge;
        writeVariable(surface, "--lg-active", current.active.toFixed(4));
        writeVariable(surface, "--lg-edge", current.edge.toFixed(4));
        surface.render = current.active === 0 && current.edge === 0 ? null : current;
      }

      const pointerSettling = pointer.x.value !== pointer.targetX ||
        pointer.y.value !== pointer.targetY;
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
      resizeObserver.disconnect();
      mutationObserver.disconnect();
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

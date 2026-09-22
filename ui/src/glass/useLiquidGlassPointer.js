import { useEffect } from "react";
import { clamp, computeSurfaceMetrics, smoothstep } from "./roundedRectField.js";

function approach(current, target, rate, delta, epsilon = 0.001) {
  const next = current + (target - current) * (1 - Math.exp(-rate * delta));
  return Math.abs(next - target) < epsilon ? target : next;
}

function writeVariable(surface, name, value) {
  surface.styleValueCache ??= new Map();
  if (surface.styleValueCache.get(name) !== value) {
    surface.styleValueCache.set(name, value);
    surface.element.style.setProperty(name, value);
  }
}

function resetSurface(surface) {
  surface.render = { active: 0, edge: 0 };
  writeVariable(surface, "--lg-active", "0");
  writeVariable(surface, "--lg-edge", "0");
}

export function useLiquidGlassPointer({
  groupRef,
  overlayRef,
  surfacesRef,
  resizeObserverRef,
  markMeasurementsDirtyRef,
  enabled = true,
  spillRadius = 220,
  maxActiveSurfaces = 6,
}) {
  useEffect(() => {
    const group = groupRef.current;
    const overlay = overlayRef.current;
    const surfaces = surfacesRef.current;
    if (!group || !overlay) return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const forcedColors = window.matchMedia("(forced-colors: active)");
    const radius = Math.max(1, Number(spillRadius) || 220);
    const surfaceLimit = clamp(Math.floor(Number(maxActiveSurfaces) || 0), 0, 12);
    const pointer = {
      active: false,
      positioned: false,
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      opacity: 0,
      stretch: 1,
      angle: 0,
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
      if (pointer.active || pointer.opacity > 0) requestFrame();
    }

    function measureSurfaces() {
      // Batch layout reads before any per-frame style writes.
      for (const surface of surfaces.values()) {
        if (surface.element.isConnected) {
          surface.rect = surface.element.getBoundingClientRect();
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
      pointer.opacity = 0;
      pointer.stretch = 1;
      overlay.style.opacity = "0";
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
        pointer.x = event.clientX;
        pointer.y = event.clientY;
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

      const previousX = pointer.x;
      const previousY = pointer.y;
      pointer.x = approach(pointer.x, pointer.targetX, 21, delta, 0.025);
      pointer.y = approach(pointer.y, pointer.targetY, 21, delta, 0.025);
      pointer.opacity = approach(pointer.opacity, pointer.active ? 1 : 0, 14, delta);
      const speed = Math.hypot(pointer.x - previousX, pointer.y - previousY) / delta;
      const targetStretch = 1 + clamp(speed / 8000, 0, 0.13);
      pointer.stretch = approach(pointer.stretch, targetStretch, 16, delta);
      if (speed > 30) pointer.angle = Math.atan2(pointer.y - previousY, pointer.x - previousX);

      const candidates = [];
      if (pointer.active) {
        for (const surface of surfaces.values()) {
          const rect = surface.rect;
          if (!rect || !surface.element.isConnected || surface.interactive === false ||
            rect.width === 0 || rect.height === 0 ||
            pointer.x < rect.left - radius || pointer.x > rect.right + radius ||
            pointer.y < rect.top - radius || pointer.y > rect.bottom + radius) continue;

          const metrics = computeSurfaceMetrics(pointer.x, pointer.y, rect, surface.radius);
          const proximity = 1 - smoothstep(0, radius, Math.max(0, metrics.d));
          if (proximity > 0) candidates.push({ surface, metrics, proximity });
        }
      }
      candidates.sort((a, b) => b.proximity - a.proximity || Math.abs(a.metrics.d) - Math.abs(b.metrics.d));
      const active = new Map(candidates.slice(0, surfaceLimit).map((item) => [item.surface.id, item]));
      let surfacesSettling = false;

      for (const surface of surfaces.values()) {
        const candidate = active.get(surface.id);
        const current = surface.render ?? { active: 0, edge: 0 };
        const strength = clamp(Number(surface.intensity) || 0, 0, 1.5);
        const targetActive = candidate ? candidate.proximity * strength : 0;
        const targetEdge = candidate
          ? (1 - smoothstep(0, 115, Math.abs(candidate.metrics.d))) * strength
          : 0;
        current.active = approach(current.active, targetActive, 15, delta);
        current.edge = approach(current.edge, targetEdge, 15, delta);
        surface.render = current;
        surfacesSettling ||= current.active !== targetActive || current.edge !== targetEdge;

        if (candidate) {
          writeVariable(surface, "--lg-local-x", `${candidate.metrics.elementX.toFixed(2)}px`);
          writeVariable(surface, "--lg-local-y", `${candidate.metrics.elementY.toFixed(2)}px`);
          writeVariable(surface, "--lg-boundary-x", `${candidate.metrics.boundaryX.toFixed(2)}px`);
          writeVariable(surface, "--lg-boundary-y", `${candidate.metrics.boundaryY.toFixed(2)}px`);
        }
        writeVariable(surface, "--lg-active", current.active.toFixed(4));
        writeVariable(surface, "--lg-edge", current.edge.toFixed(4));
      }

      overlay.style.transform = `translate3d(${pointer.x.toFixed(2)}px, ${pointer.y.toFixed(2)}px, 0)`;
      overlay.style.opacity = pointer.opacity.toFixed(4);
      overlay.style.setProperty("--glass-stretch", pointer.stretch.toFixed(4));
      overlay.style.setProperty("--glass-angle", `${pointer.angle.toFixed(3)}rad`);

      const pointerSettling = pointer.x !== pointer.targetX || pointer.y !== pointer.targetY ||
        pointer.opacity !== (pointer.active ? 1 : 0) || pointer.stretch !== 1;
      // A stationary pointer keeps its glass highlight without spending frames.
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
  }, [enabled, groupRef, overlayRef, surfacesRef, resizeObserverRef,
    markMeasurementsDirtyRef, spillRadius, maxActiveSurfaces]);
}

import { useEffect, useRef } from "react";
import {
  LIQUID_GLASS_CONSTANTS,
  clamp,
  computeSurfaceMetrics,
  lerp,
  saturate,
  smoothstep,
} from "./roundedRectField.js";

const DEFAULT_RENDER_VALUES = {
  localX: 50,
  localY: 50,
  boundaryX: 50,
  boundaryY: 50,
  outerX: 50,
  outerY: 50,
  boundaryViewportX: 0,
  boundaryViewportY: 0,
  localPxX: 0,
  localPxY: 0,
  boundaryPxX: 0,
  boundaryPxY: 0,
  normalX: 0,
  normalY: -1,
  d: 999,
  edge: 0,
  insideEdge: 0,
  outsideEdge: 0,
  innerActive: 0,
  outsideActive: 0,
  cross: 0,
  crossDir: 0,
  spill: 0,
  active: 0,
  velX: 0,
  velY: 0,
};

function createRenderValues() {
  return { ...DEFAULT_RENDER_VALUES };
}

function writeSurfaceVariables(element, values) {
  element.style.setProperty("--lg-local-x", `${values.localX.toFixed(2)}%`);
  element.style.setProperty("--lg-local-y", `${values.localY.toFixed(2)}%`);
  element.style.setProperty("--lg-boundary-x", `${values.boundaryX.toFixed(2)}%`);
  element.style.setProperty("--lg-boundary-y", `${values.boundaryY.toFixed(2)}%`);
  element.style.setProperty("--lg-outer-x", `${values.outerX.toFixed(2)}%`);
  element.style.setProperty("--lg-outer-y", `${values.outerY.toFixed(2)}%`);
  element.style.setProperty("--lg-local-px-x", `${values.localPxX.toFixed(2)}px`);
  element.style.setProperty("--lg-local-px-y", `${values.localPxY.toFixed(2)}px`);
  element.style.setProperty("--lg-boundary-px-x", `${values.boundaryPxX.toFixed(2)}px`);
  element.style.setProperty("--lg-boundary-px-y", `${values.boundaryPxY.toFixed(2)}px`);
  element.style.setProperty("--lg-normal-x", values.normalX.toFixed(4));
  element.style.setProperty("--lg-normal-y", values.normalY.toFixed(4));
  element.style.setProperty("--lg-d", `${values.d.toFixed(2)}px`);
  element.style.setProperty("--lg-edge", values.edge.toFixed(4));
  element.style.setProperty("--lg-inside-edge", values.insideEdge.toFixed(4));
  element.style.setProperty("--lg-outside-edge", values.outsideEdge.toFixed(4));
  element.style.setProperty("--glass-inner-active", values.innerActive.toFixed(4));
  element.style.setProperty("--glass-outside-active", values.outsideActive.toFixed(4));
  element.style.setProperty("--lg-cross", values.cross.toFixed(4));
  element.style.setProperty("--lg-cross-dir", values.crossDir.toFixed(4));
  element.style.setProperty("--lg-spill", values.spill.toFixed(4));
  element.style.setProperty("--lg-active", values.active.toFixed(4));
  element.style.setProperty("--lg-vel-x", values.velX.toFixed(2));
  element.style.setProperty("--lg-vel-y", values.velY.toFixed(2));
}

function measureSurface(surface) {
  const rect = surface.element.getBoundingClientRect();
  surface.rect = {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: Math.max(rect.width, 1),
    height: Math.max(rect.height, 1),
  };
}

function toPercent(value, size, overscan) {
  const safeSize = Math.max(size, 1);
  const overscanPercent = (overscan / safeSize) * 100;

  return clamp((value / safeSize) * 100, -overscanPercent, 100 + overscanPercent);
}

function getOuterPercent(boundaryValue, normal, size, offset) {
  return toPercent(boundaryValue + normal * offset, size, offset * 2);
}

function computeLayerActivity(metrics) {
  const signedDistance = metrics.d;
  const isOutside = signedDistance >= 0;
  const edgeBlendWidth = 18;
  const outsideAmount = smoothstep(0, edgeBlendWidth, signedDistance);
  const insideAmount = 1 - smoothstep(-edgeBlendWidth, 0, signedDistance);
  const insideStrength = saturate(
    metrics.edgeProximity * 0.58 +
      metrics.insideEdge * 0.64 +
      (signedDistance < 0 ? 0.08 : 0)
  );
  const outsideStrength = metrics.outsideEdge;

  return {
    innerActive: isOutside ? 0 : insideAmount * insideStrength,
    outsideActive: isOutside ? outsideAmount * outsideStrength : 0,
  };
}

function scoreMetrics(metrics) {
  return (
    metrics.edgeProximity * 2.2 +
    metrics.insideEdge * 1.2 +
    metrics.outsideEdge * 1.1 +
    metrics.focusStrength * 0.42
  );
}

function makeTargetValues(surface, entry) {
  const metrics = entry?.metrics;
  const isPrimary = Boolean(entry?.primary);
  const width = surface.rect?.width || 1;
  const height = surface.rect?.height || 1;
  const base = surface.render || createRenderValues();
  const visual = isPrimary ? metrics : null;
  const cross = 0;
  const crossDir = 0;

  if (!visual) {
    return {
      ...base,
      edge: 0,
      insideEdge: 0,
      outsideEdge: 0,
      innerActive: 0,
      outsideActive: 0,
      cross,
      crossDir,
      spill: 0,
      active: cross,
      velX: 0,
      velY: 0,
    };
  }

  const boundaryViewportX = surface.rect.left + visual.boundaryX;
  const boundaryViewportY = surface.rect.top + visual.boundaryY;
  const outerOffset = 10;
  const { innerActive, outsideActive } = computeLayerActivity(metrics);
  const primaryActive = isPrimary
    ? saturate(
        innerActive * 0.72 +
          outsideActive * 0.62 +
          metrics.insideEdge * 0.22 +
          metrics.outsideEdge * 0.18
      )
    : 0;
  const spillStrength = 0;

  return {
    localX: metrics?.localPercentX ?? base.localX,
    localY: metrics?.localPercentY ?? base.localY,
    boundaryX: visual.boundaryPercentX,
    boundaryY: visual.boundaryPercentY,
    outerX: getOuterPercent(visual.boundaryX, visual.normalX, width, outerOffset),
    outerY: getOuterPercent(visual.boundaryY, visual.normalY, height, outerOffset),
    boundaryViewportX,
    boundaryViewportY,
    localPxX: metrics?.elementX ?? base.localPxX,
    localPxY: metrics?.elementY ?? base.localPxY,
    boundaryPxX: visual.boundaryX,
    boundaryPxY: visual.boundaryY,
    normalX: visual.normalX,
    normalY: visual.normalY,
    d: metrics?.d ?? base.d,
    edge: isPrimary ? metrics.edgeProximity * innerActive : spillStrength * 0.22,
    insideEdge: isPrimary ? metrics.insideEdge : 0,
    outsideEdge: isPrimary ? metrics.outsideEdge : 0,
    innerActive: isPrimary ? innerActive : 0,
    outsideActive: isPrimary ? outsideActive : 0,
    cross,
    crossDir,
    spill: spillStrength,
    active: primaryActive,
    velX: metrics?.velocityX ?? 0,
    velY: metrics?.velocityY ?? 0,
  };
}

function advanceSurfaceRender(surface, target, reducedMotion) {
  const current = surface.render || createRenderValues();
  const t = reducedMotion ? 0.55 : LIQUID_GLASS_CONSTANTS.HIGHLIGHT_LERP;

  current.localX = lerp(current.localX, target.localX, t);
  current.localY = lerp(current.localY, target.localY, t);
  current.boundaryX = lerp(current.boundaryX, target.boundaryX, t);
  current.boundaryY = lerp(current.boundaryY, target.boundaryY, t);
  current.outerX = lerp(current.outerX, target.outerX, t);
  current.outerY = lerp(current.outerY, target.outerY, t);
  current.boundaryViewportX = lerp(
    current.boundaryViewportX,
    target.boundaryViewportX,
    t
  );
  current.boundaryViewportY = lerp(
    current.boundaryViewportY,
    target.boundaryViewportY,
    t
  );
  current.localPxX = lerp(current.localPxX, target.localPxX, t);
  current.localPxY = lerp(current.localPxY, target.localPxY, t);
  current.boundaryPxX = lerp(current.boundaryPxX, target.boundaryPxX, t);
  current.boundaryPxY = lerp(current.boundaryPxY, target.boundaryPxY, t);
  current.normalX = lerp(current.normalX, target.normalX, t);
  current.normalY = lerp(current.normalY, target.normalY, t);
  current.d = lerp(current.d, target.d, t);
  current.edge = lerp(current.edge, target.edge, t);
  current.insideEdge = lerp(current.insideEdge, target.insideEdge, t);
  current.outsideEdge = lerp(current.outsideEdge, target.outsideEdge, t);
  current.innerActive = lerp(current.innerActive, target.innerActive, t);
  current.outsideActive = lerp(current.outsideActive, target.outsideActive, t);
  current.cross = lerp(current.cross, target.cross, t);
  current.crossDir = lerp(current.crossDir, target.crossDir, t);
  current.spill = lerp(current.spill, target.spill, t);
  current.active = lerp(current.active, target.active, t);
  current.velX = lerp(current.velX, target.velX, t);
  current.velY = lerp(current.velY, target.velY, t);
  surface.render = current;

  writeSurfaceVariables(surface.element, current);

  return Math.max(
    current.active,
    current.edge,
    current.insideEdge,
    current.outsideEdge,
    current.innerActive,
    current.outsideActive,
    current.cross,
    current.spill
  );
}

function prepareCanvas(canvas) {
  if (!canvas) {
    return null;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return null;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  return ctx;
}

function addRoundedRect(path, x, y, width, height, radius) {
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  const safeRadius = clamp(radius, 0, Math.min(safeWidth, safeHeight) * 0.5);
  const right = x + safeWidth;
  const bottom = y + safeHeight;

  path.moveTo(x + safeRadius, y);
  path.lineTo(right - safeRadius, y);
  path.quadraticCurveTo(right, y, right, y + safeRadius);
  path.lineTo(right, bottom - safeRadius);
  path.quadraticCurveTo(right, bottom, right - safeRadius, bottom);
  path.lineTo(x + safeRadius, bottom);
  path.quadraticCurveTo(x, bottom, x, bottom - safeRadius);
  path.lineTo(x, y + safeRadius);
  path.quadraticCurveTo(x, y, x + safeRadius, y);
  path.closePath();
}

function setGradientStops(gradient, active, stops) {
  for (const [offset, color] of stops) {
    gradient.addColorStop(offset, color(active));
  }
}

function drawOutsideFieldForSurface(ctx, surface, surfaces) {
  const render = surface.render;
  const rect = surface.rect;
  const active = saturate((render?.outsideActive ?? 0) * (surface.intensity ?? 1));

  if (!render || !rect || active <= 0.004) {
    return 0;
  }

  const range = 80;
  const boundaryX = render.boundaryViewportX;
  const boundaryY = render.boundaryViewportY;
  const normalAngle = Math.atan2(render.normalY, render.normalX);
  const tangentAngle = normalAngle + Math.PI * 0.5;
  const outerRect = {
    x: rect.left - range,
    y: rect.top - range,
    width: rect.width + range * 2,
    height: rect.height + range * 2,
  };

  const ringPath = new Path2D();
  addRoundedRect(
    ringPath,
    outerRect.x,
    outerRect.y,
    outerRect.width,
    outerRect.height,
    (surface.radius ?? 28) + range
  );
  addRoundedRect(
    ringPath,
    rect.left - 0.5,
    rect.top - 0.5,
    rect.width + 1,
    rect.height + 1,
    (surface.radius ?? 28) + 0.5
  );

  for (const clippedSurface of surfaces) {
    const clippedRect = clippedSurface.rect;

    if (!clippedRect || clippedSurface === surface) {
      continue;
    }

    addRoundedRect(
      ringPath,
      clippedRect.left - 0.5,
      clippedRect.top - 0.5,
      clippedRect.width + 1,
      clippedRect.height + 1,
      (clippedSurface.radius ?? 28) + 0.5
    );
  }

  ctx.save();
  ctx.clip(ringPath, "evenodd");
  ctx.globalCompositeOperation = "screen";

  const halo = ctx.createRadialGradient(
    boundaryX,
    boundaryY,
    0,
    boundaryX,
    boundaryY,
    range * 1.15
  );
  setGradientStops(halo, active, [
    [0, (a) => `rgba(255, 255, 255, ${0.36 * a})`],
    [0.22, (a) => `rgba(191, 219, 254, ${0.24 * a})`],
    [0.5, (a) => `rgba(96, 165, 250, ${0.12 * a})`],
    [1, () => "rgba(255, 255, 255, 0)"],
  ]);
  ctx.fillStyle = halo;
  ctx.fillRect(outerRect.x, outerRect.y, outerRect.width, outerRect.height);

  ctx.save();
  ctx.translate(boundaryX, boundaryY);
  ctx.rotate(tangentAngle);
  ctx.scale(1.55, 0.42);

  const rim = ctx.createRadialGradient(0, 0, 0, 0, 0, range * 0.74);
  setGradientStops(rim, active, [
    [0, (a) => `rgba(255, 255, 255, ${0.5 * a})`],
    [0.24, (a) => `rgba(219, 234, 254, ${0.26 * a})`],
    [0.54, (a) => `rgba(56, 189, 248, ${0.12 * a})`],
    [1, () => "rgba(255, 255, 255, 0)"],
  ]);
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(0, 0, range * 0.74, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();

  return active;
}

function drawOutsideFieldOverlay(canvas, surfaces) {
  const ctx = prepareCanvas(canvas);

  if (!ctx) {
    return 0;
  }

  let activity = 0;

  for (const surface of surfaces) {
    activity = Math.max(activity, drawOutsideFieldForSurface(ctx, surface, surfaces));
  }

  return activity;
}

function pointerIsInsideGroup(pointer, groupRect, overscan) {
  if (!groupRect) {
    return true;
  }

  return (
    pointer.x >= groupRect.left - overscan &&
    pointer.x <= groupRect.right + overscan &&
    pointer.y >= groupRect.top - overscan &&
    pointer.y <= groupRect.bottom + overscan
  );
}

export function useLiquidGlassPointer({
  groupRef,
  overlayRef,
  surfacesRef,
  resizeObserverRef,
  markMeasurementsDirtyRef,
  overscan = LIQUID_GLASS_CONSTANTS.GROUP_OVERSCAN,
  spillRadius = LIQUID_GLASS_CONSTANTS.SPILL_RADIUS,
  maxActiveSurfaces = LIQUID_GLASS_CONSTANTS.MAX_ACTIVE_SURFACES,
}) {
  const frameRef = useRef(null);
  const measurementsDirtyRef = useRef(true);
  const groupRectRef = useRef(null);
  const reducedMotionRef = useRef(false);
  const optionsRef = useRef({
    overscan,
    spillRadius,
    maxActiveSurfaces,
  });
  const pointerRef = useRef({
    hasPointer: false,
    hasCurrent: false,
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    previousX: 0,
    previousY: 0,
    velocityX: 0,
    velocityY: 0,
  });

  useEffect(() => {
    optionsRef.current = {
      overscan,
      spillRadius,
      maxActiveSurfaces,
    };
    markMeasurementsDirtyRef.current();
  }, [markMeasurementsDirtyRef, overscan, spillRadius, maxActiveSurfaces]);

  useEffect(() => {
    const groupElement = groupRef.current;
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    function markMeasurementsDirty() {
      measurementsDirtyRef.current = true;
      requestFrame();
    }

    function measureAll() {
      if (groupElement) {
        const rect = groupElement.getBoundingClientRect();
        groupRectRef.current = {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: Math.max(rect.width, 1),
          height: Math.max(rect.height, 1),
        };
      }

      for (const surface of surfacesRef.current.values()) {
        if (surface.element?.isConnected) {
          measureSurface(surface);
        }
      }

      measurementsDirtyRef.current = false;
    }

    function requestFrame() {
      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(runFrame);
      }
    }

    function updatePointerFromEvent(event) {
      const pointer = pointerRef.current;
      pointer.hasPointer = true;
      pointer.targetX = event.clientX;
      pointer.targetY = event.clientY;

      if (!pointer.hasCurrent) {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.previousX = event.clientX;
        pointer.previousY = event.clientY;
        pointer.hasCurrent = true;
      }

      requestFrame();
    }

    function clearPointer() {
      pointerRef.current.hasPointer = false;
      requestFrame();
    }

    function updateReducedMotion() {
      reducedMotionRef.current = reducedMotionQuery.matches;
      requestFrame();
    }

    function runFrame(now) {
      frameRef.current = null;

      if (measurementsDirtyRef.current) {
        measureAll();
      }

      const options = optionsRef.current;
      const pointer = pointerRef.current;
      const surfaces = [...surfacesRef.current.values()].filter(
        (surface) => surface.element?.isConnected && surface.rect
      );
      const dtSeconds = Math.max(1 / 120, Math.min(0.064, (now - (runFrame.lastNow || now)) / 1000));
      runFrame.lastNow = now;

      if (pointer.hasPointer) {
        const smoothing = reducedMotionRef.current
          ? 0.5
          : LIQUID_GLASS_CONSTANTS.POINTER_SMOOTHING;

        pointer.previousX = pointer.x;
        pointer.previousY = pointer.y;
        pointer.x = lerp(pointer.x, pointer.targetX, smoothing);
        pointer.y = lerp(pointer.y, pointer.targetY, smoothing);
        pointer.velocityX = lerp(
          pointer.velocityX,
          (pointer.x - pointer.previousX) / dtSeconds,
          LIQUID_GLASS_CONSTANTS.VELOCITY_SMOOTHING
        );
        pointer.velocityY = lerp(
          pointer.velocityY,
          (pointer.y - pointer.previousY) / dtSeconds,
          LIQUID_GLASS_CONSTANTS.VELOCITY_SMOOTHING
        );
      } else {
        pointer.velocityX = lerp(pointer.velocityX, 0, 0.24);
        pointer.velocityY = lerp(pointer.velocityY, 0, 0.24);
      }

      if (!pointerIsInsideGroup(pointer, groupRectRef.current, options.overscan * 2.2)) {
        pointer.hasPointer = false;
      }

      const entries = new Map();
      const candidateEntries = [];

      if (pointer.hasPointer) {
        for (const surface of surfaces) {
          const metrics = computeSurfaceMetrics(
            pointer.x,
            pointer.y,
            surface.rect,
            surface.radius,
            { x: pointer.velocityX, y: pointer.velocityY },
            LIQUID_GLASS_CONSTANTS
          );
          const inSurfaceRange = metrics.d <= 0 || metrics.d <= options.overscan;
          const score = inSurfaceRange ? scoreMetrics(metrics) : 0;

          if (score > 0 && surface.interactive !== false) {
            const entry = {
              surface,
              metrics,
              score,
              primary: false,
            };

            entries.set(surface.id, entry);
            candidateEntries.push(entry);
          }
        }

        candidateEntries.sort((a, b) => b.score - a.score);

        for (const entry of candidateEntries.slice(0, options.maxActiveSurfaces)) {
          entry.primary = true;
        }
      }

      let maxActivity = 0;

      for (const surface of surfaces) {
        const target = makeTargetValues(
          surface,
          entries.get(surface.id)
        );

        maxActivity = Math.max(
          maxActivity,
          advanceSurfaceRender(surface, target, reducedMotionRef.current)
        );
      }

      maxActivity = Math.max(
        maxActivity,
        drawOutsideFieldOverlay(overlayRef.current, surfaces)
      );

      const pointerStillSettling =
        pointer.hasPointer &&
        (Math.abs(pointer.targetX - pointer.x) > 0.04 ||
          Math.abs(pointer.targetY - pointer.y) > 0.04);

      if (maxActivity > 0.004 || pointerStillSettling) {
        requestFrame();
      }
    }

    markMeasurementsDirtyRef.current = markMeasurementsDirty;
    reducedMotionRef.current = reducedMotionQuery.matches;

    const resizeObserver = new ResizeObserver(markMeasurementsDirty);
    resizeObserverRef.current = resizeObserver;

    if (groupElement) {
      resizeObserver.observe(groupElement);
    }

    for (const surface of surfacesRef.current.values()) {
      resizeObserver.observe(surface.element);
      writeSurfaceVariables(surface.element, surface.render || createRenderValues());
    }

    window.addEventListener("pointermove", updatePointerFromEvent, { passive: true });
    window.addEventListener("pointercancel", clearPointer, { passive: true });
    window.addEventListener("blur", clearPointer);
    window.addEventListener("resize", markMeasurementsDirty, { passive: true });
    window.addEventListener("scroll", markMeasurementsDirty, true);
    reducedMotionQuery.addEventListener("change", updateReducedMotion);
    measureAll();
    requestFrame();

    return () => {
      window.removeEventListener("pointermove", updatePointerFromEvent);
      window.removeEventListener("pointercancel", clearPointer);
      window.removeEventListener("blur", clearPointer);
      window.removeEventListener("resize", markMeasurementsDirty);
      window.removeEventListener("scroll", markMeasurementsDirty, true);
      reducedMotionQuery.removeEventListener("change", updateReducedMotion);
      resizeObserver.disconnect();
      resizeObserverRef.current = null;
      markMeasurementsDirtyRef.current = () => {};

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [
    groupRef,
    markMeasurementsDirtyRef,
    overlayRef,
    resizeObserverRef,
    surfacesRef,
  ]);
}

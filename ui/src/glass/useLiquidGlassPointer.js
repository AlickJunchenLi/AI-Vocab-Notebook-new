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

const ACTIVITY_EPSILON = 0.0035;
const MAX_ACTIVE_SURFACES_CAP = 4;

function createRenderValues() {
  return { ...DEFAULT_RENDER_VALUES };
}

function writeSurfaceVariable(surface, name, value) {
  const cache = surface.styleValueCache ?? new Map();
  surface.styleValueCache = cache;

  if (cache.get(name) === value) {
    return;
  }

  cache.set(name, value);
  surface.element.style.setProperty(name, value);
}

function writeSurfaceVariables(surface, values) {
  writeSurfaceVariable(surface, "--lg-local-x", `${values.localX.toFixed(2)}%`);
  writeSurfaceVariable(surface, "--lg-local-y", `${values.localY.toFixed(2)}%`);
  writeSurfaceVariable(surface, "--lg-boundary-x", `${values.boundaryX.toFixed(2)}%`);
  writeSurfaceVariable(surface, "--lg-boundary-y", `${values.boundaryY.toFixed(2)}%`);
  writeSurfaceVariable(surface, "--lg-outer-x", `${values.outerX.toFixed(2)}%`);
  writeSurfaceVariable(surface, "--lg-outer-y", `${values.outerY.toFixed(2)}%`);
  writeSurfaceVariable(surface, "--lg-local-px-x", `${values.localPxX.toFixed(2)}px`);
  writeSurfaceVariable(surface, "--lg-local-px-y", `${values.localPxY.toFixed(2)}px`);
  writeSurfaceVariable(surface, "--lg-boundary-px-x", `${values.boundaryPxX.toFixed(2)}px`);
  writeSurfaceVariable(surface, "--lg-boundary-px-y", `${values.boundaryPxY.toFixed(2)}px`);
  writeSurfaceVariable(surface, "--lg-normal-x", values.normalX.toFixed(4));
  writeSurfaceVariable(surface, "--lg-normal-y", values.normalY.toFixed(4));
  writeSurfaceVariable(surface, "--lg-d", `${values.d.toFixed(2)}px`);
  writeSurfaceVariable(surface, "--lg-edge", values.edge.toFixed(4));
  writeSurfaceVariable(surface, "--lg-inside-edge", values.insideEdge.toFixed(4));
  writeSurfaceVariable(surface, "--lg-outside-edge", values.outsideEdge.toFixed(4));
  writeSurfaceVariable(surface, "--glass-inner-active", values.innerActive.toFixed(4));
  writeSurfaceVariable(surface, "--glass-outside-active", values.outsideActive.toFixed(4));
  writeSurfaceVariable(surface, "--lg-cross", values.cross.toFixed(4));
  writeSurfaceVariable(surface, "--lg-cross-dir", values.crossDir.toFixed(4));
  writeSurfaceVariable(surface, "--lg-spill", values.spill.toFixed(4));
  writeSurfaceVariable(surface, "--lg-active", values.active.toFixed(4));
  writeSurfaceVariable(surface, "--lg-vel-x", values.velX.toFixed(2));
  writeSurfaceVariable(surface, "--lg-vel-y", values.velY.toFixed(2));
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

function getVisualActivity(values) {
  if (!values) {
    return 0;
  }

  return Math.max(
    values.active,
    values.edge,
    values.insideEdge,
    values.outsideEdge,
    values.innerActive,
    values.outsideActive,
    values.cross,
    values.spill
  );
}

function makeTargetValues(surface, entry) {
  const metrics = entry?.metrics;
  const isPrimary = Boolean(entry?.primary);
  const width = surface.rect?.width || 1;
  const height = surface.rect?.height || 1;
  const base = surface.render || createRenderValues();
  const visual = metrics ?? null;
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
  const spillStrength = saturate(entry?.spillStrength ?? 0) *
    (isPrimary ? 0.14 : 0.2);

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
    edge: isPrimary ? metrics.edgeProximity * innerActive : spillStrength * 0.16,
    insideEdge: isPrimary ? metrics.insideEdge : 0,
    outsideEdge: isPrimary ? metrics.outsideEdge : 0,
    innerActive: isPrimary ? innerActive : 0,
    outsideActive: isPrimary ? outsideActive : 0,
    cross,
    crossDir,
    spill: spillStrength,
    active: Math.max(primaryActive, spillStrength * 0.42),
    velX: metrics?.velocityX ?? 0,
    velY: metrics?.velocityY ?? 0,
  };
}

function advanceSurfaceRender(surface, target) {
  const current = surface.render || createRenderValues();
  const targetActivity = getVisualActivity(target);

  if (
    surface.renderSettled &&
    getVisualActivity(current) <= ACTIVITY_EPSILON &&
    targetActivity <= ACTIVITY_EPSILON
  ) {
    return { activity: 0, unsettled: false };
  }

  const t = LIQUID_GLASS_CONSTANTS.HIGHLIGHT_LERP;
  let unsettled = false;

  function advance(key, epsilon) {
    const previous = current[key];
    const next = lerp(previous, target[key], t);

    if (Math.abs(target[key] - next) <= epsilon) {
      current[key] = target[key];
    } else {
      current[key] = next;
      unsettled = true;
    }
  }

  advance("localX", 0.01);
  advance("localY", 0.01);
  advance("boundaryX", 0.01);
  advance("boundaryY", 0.01);
  advance("outerX", 0.01);
  advance("outerY", 0.01);
  advance("boundaryViewportX", 0.05);
  advance("boundaryViewportY", 0.05);
  advance("localPxX", 0.05);
  advance("localPxY", 0.05);
  advance("boundaryPxX", 0.05);
  advance("boundaryPxY", 0.05);
  advance("normalX", 0.0005);
  advance("normalY", 0.0005);
  advance("d", 0.05);
  advance("edge", 0.0005);
  advance("insideEdge", 0.0005);
  advance("outsideEdge", 0.0005);
  advance("innerActive", 0.0005);
  advance("outsideActive", 0.0005);
  advance("cross", 0.0005);
  advance("crossDir", 0.0005);
  advance("spill", 0.0005);
  advance("active", 0.0005);
  advance("velX", 0.25);
  advance("velY", 0.25);
  surface.render = current;
  const activity = getVisualActivity(current);

  if (activity <= ACTIVITY_EPSILON && targetActivity <= ACTIVITY_EPSILON) {
    current.edge = 0;
    current.insideEdge = 0;
    current.outsideEdge = 0;
    current.innerActive = 0;
    current.outsideActive = 0;
    current.cross = 0;
    current.crossDir = 0;
    current.spill = 0;
    current.active = 0;
    current.velX = 0;
    current.velY = 0;
    surface.renderSettled = true;
    writeSurfaceVariables(surface, current);

    return { activity: 0, unsettled: false };
  }

  surface.renderSettled = !unsettled;
  writeSurfaceVariables(surface, current);

  return { activity, unsettled };
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

function getCanvasActivity(surface) {
  const render = surface.render;

  if (!render) {
    return 0;
  }

  return saturate(
    (render.outsideActive * 0.9 +
      render.innerActive * 0.42 +
      render.edge * 0.28 +
      render.spill * 0.34) *
      (surface.intensity ?? 1)
  );
}

function drawOutsideFieldForSurface(ctx, surface) {
  const render = surface.render;
  const rect = surface.rect;
  const active = getCanvasActivity(surface);

  if (!render || !rect || active <= 0.004) {
    return 0;
  }

  const range = 88;
  const boundaryX = render.boundaryViewportX;
  const boundaryY = render.boundaryViewportY;
  const normalAngle = Math.atan2(render.normalY, render.normalX);
  const tangentAngle = normalAngle + Math.PI * 0.5;
  const tangentX = -render.normalY;
  const tangentY = render.normalX;
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
    [0, (a) => `rgba(255, 255, 255, ${0.44 * a})`],
    [0.2, (a) => `rgba(219, 234, 254, ${0.3 * a})`],
    [0.48, (a) => `rgba(96, 165, 250, ${0.14 * a})`],
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
    [0, (a) => `rgba(255, 255, 255, ${0.56 * a})`],
    [0.22, (a) => `rgba(224, 242, 254, ${0.3 * a})`],
    [0.52, (a) => `rgba(96, 165, 250, ${0.13 * a})`],
    [1, () => "rgba(255, 255, 255, 0)"],
  ]);
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(0, 0, range * 0.74, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const prismLobes = [
    {
      tangent: -10,
      normal: 13,
      inner: (a) => `rgba(167, 139, 250, ${0.13 * a})`,
      outer: (a) => `rgba(196, 181, 253, ${0.035 * a})`,
    },
    {
      tangent: 6,
      normal: 16,
      inner: (a) => `rgba(103, 232, 249, ${0.15 * a})`,
      outer: (a) => `rgba(125, 211, 252, ${0.04 * a})`,
    },
    {
      tangent: 17,
      normal: 10,
      inner: (a) => `rgba(253, 186, 116, ${0.1 * a})`,
      outer: (a) => `rgba(254, 215, 170, ${0.025 * a})`,
    },
  ];

  for (const lobe of prismLobes) {
    const x = boundaryX + tangentX * lobe.tangent + render.normalX * lobe.normal;
    const y = boundaryY + tangentY * lobe.tangent + render.normalY * lobe.normal;
    const prism = ctx.createRadialGradient(x, y, 0, x, y, range * 0.7);
    setGradientStops(prism, active, [
      [0, lobe.inner],
      [0.42, lobe.outer],
      [1, () => "rgba(255, 255, 255, 0)"],
    ]);
    ctx.fillStyle = prism;
    ctx.fillRect(outerRect.x, outerRect.y, outerRect.width, outerRect.height);
  }

  ctx.restore();

  return active;
}

function drawPointerLens(ctx, pointer, surfaceActivity) {
  if (!pointer?.hasPointer) {
    return 0;
  }

  const speed = Math.min(
    1,
    Math.hypot(pointer.velocityX, pointer.velocityY) / 900
  );
  const active = 0.52 + surfaceActivity * 0.28;
  const radius = 48 + speed * 7;
  const x = pointer.x;
  const y = pointer.y;

  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  const body = ctx.createRadialGradient(x - 8, y - 9, 2, x, y, radius);
  body.addColorStop(0, `rgba(255, 255, 255, ${0.12 * active})`);
  body.addColorStop(0.55, `rgba(224, 242, 254, ${0.08 * active})`);
  body.addColorStop(0.78, `rgba(167, 139, 250, ${0.07 * active})`);
  body.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  const rim = ctx.createLinearGradient(
    x - radius,
    y - radius,
    x + radius,
    y + radius
  );
  rim.addColorStop(0, `rgba(255, 255, 255, ${0.68 * active})`);
  rim.addColorStop(0.23, `rgba(103, 232, 249, ${0.5 * active})`);
  rim.addColorStop(0.52, `rgba(129, 140, 248, ${0.58 * active})`);
  rim.addColorStop(0.76, `rgba(244, 114, 182, ${0.34 * active})`);
  rim.addColorStop(1, `rgba(253, 186, 116, ${0.38 * active})`);
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1.35;
  ctx.beginPath();
  ctx.arc(x, y, radius - 1, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255, 255, 255, ${0.72 * active})`;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(x, y, radius - 4, Math.PI * 1.08, Math.PI * 1.68);
  ctx.stroke();

  ctx.strokeStyle = `rgba(111, 208, 255, ${0.18 * active})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x + 2, y + 1, radius + 2, -0.18, Math.PI * 0.82);
  ctx.stroke();

  ctx.restore();

  return active;
}

function drawOutsideFieldOverlay(canvas, surface, pointer) {
  const ctx = prepareCanvas(canvas);

  if (!ctx) {
    return 0;
  }

  const surfaceActivity = surface ? getCanvasActivity(surface) : 0;
  const pointerActivity = drawPointerLens(ctx, pointer, surfaceActivity);
  const outsideActivity = surface
    ? drawOutsideFieldForSurface(ctx, surface)
    : 0;

  return Math.max(pointerActivity, outsideActivity);
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
    const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    let effectEnabled = false;
    let pointerListenersAttached = false;

    function cancelFrame() {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      runFrame.lastNow = 0;
    }

    function clearCanvas() {
      const canvas = overlayRef.current;
      const ctx = canvas?.getContext("2d");

      if (!canvas || !ctx) {
        return;
      }

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    function resetPointerState() {
      const pointer = pointerRef.current;
      pointer.hasPointer = false;
      pointer.hasCurrent = false;
      pointer.x = 0;
      pointer.y = 0;
      pointer.targetX = 0;
      pointer.targetY = 0;
      pointer.previousX = 0;
      pointer.previousY = 0;
      pointer.velocityX = 0;
      pointer.velocityY = 0;
    }

    function resetSurfaceEffects() {
      for (const surface of surfacesRef.current.values()) {
        if (!surface.element?.isConnected) {
          continue;
        }

        const values = createRenderValues();
        surface.render = values;
        surface.renderSettled = true;
        writeSurfaceVariables(surface, values);
      }
    }

    function markMeasurementsDirty() {
      measurementsDirtyRef.current = true;

      if (effectEnabled) {
        requestFrame();
      }
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
      if (effectEnabled && frameRef.current === null) {
        frameRef.current = requestAnimationFrame(runFrame);
      }
    }

    function updatePointerFromEvent(event) {
      if (!effectEnabled || event.pointerType === "touch") {
        return;
      }

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

    function handlePointerLeave() {
      resetPointerState();
      requestFrame();
    }

    function handleWindowBlur() {
      resetPointerState();
      cancelFrame();
      resetSurfaceEffects();
      clearCanvas();
    }

    function attachPointerListeners() {
      if (!groupElement || pointerListenersAttached) {
        return;
      }

      groupElement.addEventListener("pointerenter", updatePointerFromEvent, {
        passive: true,
      });
      groupElement.addEventListener("pointermove", updatePointerFromEvent, {
        passive: true,
      });
      groupElement.addEventListener("pointerleave", handlePointerLeave, {
        passive: true,
      });
      groupElement.addEventListener("pointercancel", handlePointerLeave, {
        passive: true,
      });
      pointerListenersAttached = true;
    }

    function detachPointerListeners() {
      if (!groupElement || !pointerListenersAttached) {
        return;
      }

      groupElement.removeEventListener("pointerenter", updatePointerFromEvent);
      groupElement.removeEventListener("pointermove", updatePointerFromEvent);
      groupElement.removeEventListener("pointerleave", handlePointerLeave);
      groupElement.removeEventListener("pointercancel", handlePointerLeave);
      pointerListenersAttached = false;
    }

    function syncEffectAvailability() {
      const nextEnabled =
        !reducedMotionQuery.matches &&
        finePointerQuery.matches &&
        document.visibilityState !== "hidden";

      if (nextEnabled === effectEnabled) {
        return;
      }

      effectEnabled = nextEnabled;

      if (effectEnabled) {
        attachPointerListeners();
        measurementsDirtyRef.current = true;
        measureAll();
        requestFrame();
      } else {
        detachPointerListeners();
        resetPointerState();
        cancelFrame();
        resetSurfaceEffects();
        clearCanvas();
      }
    }

    function runFrame(now) {
      frameRef.current = null;

      if (!effectEnabled) {
        return;
      }

      if (measurementsDirtyRef.current) {
        measureAll();
      }

      const options = optionsRef.current;
      const pointer = pointerRef.current;
      const surfaces = [...surfacesRef.current.values()].filter(
        (surface) => surface.element?.isConnected && surface.rect
      );
      const dtSeconds = Math.max(
        1 / 120,
        Math.min(0.064, (now - (runFrame.lastNow || now)) / 1000)
      );
      runFrame.lastNow = now;

      if (pointer.hasPointer) {
        pointer.previousX = pointer.x;
        pointer.previousY = pointer.y;
        pointer.x = lerp(
          pointer.x,
          pointer.targetX,
          LIQUID_GLASS_CONSTANTS.POINTER_SMOOTHING
        );
        pointer.y = lerp(
          pointer.y,
          pointer.targetY,
          LIQUID_GLASS_CONSTANTS.POINTER_SMOOTHING
        );
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
      }

      if (!pointerIsInsideGroup(pointer, groupRectRef.current, options.overscan * 2.2)) {
        resetPointerState();
      }

      const entries = new Map();
      const candidateEntries = [];

      if (pointer.hasPointer) {
        const resolvedOverscan = Math.max(0, Number(options.overscan) || 0);
        const resolvedSpillRadius = Math.max(
          0,
          Number(options.spillRadius) || 0
        );
        const interactionRange = Math.max(
          resolvedOverscan,
          resolvedSpillRadius
        );

        for (const surface of surfaces) {
          const rect = surface.rect;

          if (
            pointer.x < rect.left - interactionRange ||
            pointer.x > rect.right + interactionRange ||
            pointer.y < rect.top - interactionRange ||
            pointer.y > rect.bottom + interactionRange
          ) {
            continue;
          }

          const metrics = computeSurfaceMetrics(
            pointer.x,
            pointer.y,
            surface.rect,
            surface.radius,
            { x: pointer.velocityX, y: pointer.velocityY },
            LIQUID_GLASS_CONSTANTS
          );
          const outsideDistance = Math.max(metrics.d, 0);
          const spillStrength =
            resolvedSpillRadius > 0
              ? 1 -
                smoothstep(
                  0,
                  resolvedSpillRadius,
                  outsideDistance
                )
              : 0;
          const inSurfaceRange =
            metrics.d <= 0 || outsideDistance <= interactionRange;
          const score = inSurfaceRange
            ? scoreMetrics(metrics) + spillStrength * 0.36
            : 0;

          if (score > 0 && surface.interactive !== false) {
            const entry = {
              surface,
              metrics,
              score,
              spillStrength,
              primary: false,
            };

            candidateEntries.push(entry);
          }
        }

        candidateEntries.sort((a, b) => b.score - a.score);

        const requestedActiveSurfaces = Number.isFinite(
          Number(options.maxActiveSurfaces)
        )
          ? Math.floor(Number(options.maxActiveSurfaces))
          : LIQUID_GLASS_CONSTANTS.MAX_ACTIVE_SURFACES;
        const activeLimit = clamp(
          requestedActiveSurfaces,
          0,
          MAX_ACTIVE_SURFACES_CAP
        );
        const activeEntries = candidateEntries.slice(0, activeLimit);

        for (const [index, entry] of activeEntries.entries()) {
          entry.primary = index === 0;
          entries.set(entry.surface.id, entry);
        }
      }

      let anySurfaceUnsettled = false;
      let causticSurface = null;
      let causticActivity = 0;

      for (const surface of surfaces) {
        const target = makeTargetValues(surface, entries.get(surface.id));
        const result = advanceSurfaceRender(surface, target);
        const surfaceCausticActivity = getCanvasActivity(surface);
        anySurfaceUnsettled = anySurfaceUnsettled || result.unsettled;

        if (surfaceCausticActivity > causticActivity) {
          causticActivity = surfaceCausticActivity;
          causticSurface = surface;
        }
      }

      drawOutsideFieldOverlay(
        overlayRef.current,
        causticSurface,
        pointer.hasPointer ? pointer : null
      );

      const pointerStillSettling =
        pointer.hasPointer &&
        (Math.abs(pointer.targetX - pointer.x) > 0.04 ||
          Math.abs(pointer.targetY - pointer.y) > 0.04);

      if (anySurfaceUnsettled || pointerStillSettling) {
        requestFrame();
      }
    }

    markMeasurementsDirtyRef.current = markMeasurementsDirty;

    const resizeObserver = new ResizeObserver(markMeasurementsDirty);
    resizeObserverRef.current = resizeObserver;

    if (groupElement) {
      resizeObserver.observe(groupElement);
    }

    for (const surface of surfacesRef.current.values()) {
      resizeObserver.observe(surface.element);
      surface.render = surface.render || createRenderValues();
      surface.renderSettled = true;
      writeSurfaceVariables(surface, surface.render);
    }

    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("resize", markMeasurementsDirty, { passive: true });
    window.addEventListener("scroll", markMeasurementsDirty, true);
    window.visualViewport?.addEventListener("resize", markMeasurementsDirty, {
      passive: true,
    });
    document.addEventListener("visibilitychange", syncEffectAvailability);
    reducedMotionQuery.addEventListener("change", syncEffectAvailability);
    finePointerQuery.addEventListener("change", syncEffectAvailability);
    syncEffectAvailability();

    return () => {
      detachPointerListeners();
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("resize", markMeasurementsDirty);
      window.removeEventListener("scroll", markMeasurementsDirty, true);
      window.visualViewport?.removeEventListener("resize", markMeasurementsDirty);
      document.removeEventListener("visibilitychange", syncEffectAvailability);
      reducedMotionQuery.removeEventListener("change", syncEffectAvailability);
      finePointerQuery.removeEventListener("change", syncEffectAvailability);
      resizeObserver.disconnect();
      resizeObserverRef.current = null;
      markMeasurementsDirtyRef.current = () => {};
      cancelFrame();
    };
  }, [
    groupRef,
    markMeasurementsDirtyRef,
    overlayRef,
    resizeObserverRef,
    surfacesRef,
  ]);
}

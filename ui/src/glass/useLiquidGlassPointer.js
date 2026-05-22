import { useEffect, useRef } from "react";
import {
  LIQUID_GLASS_CONSTANTS,
  clamp,
  computeBoundaryPointFromSdf,
  computeSdfGradient,
  computeSurfaceMetrics,
  lerp,
  saturate,
  sdRoundedRect,
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
  normalX: 0,
  normalY: -1,
  d: 999,
  edge: 0,
  insideEdge: 0,
  outsideEdge: 0,
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
  element.style.setProperty("--lg-normal-x", values.normalX.toFixed(4));
  element.style.setProperty("--lg-normal-y", values.normalY.toFixed(4));
  element.style.setProperty("--lg-d", `${values.d.toFixed(2)}px`);
  element.style.setProperty("--lg-edge", values.edge.toFixed(4));
  element.style.setProperty("--lg-inside-edge", values.insideEdge.toFixed(4));
  element.style.setProperty("--lg-outside-edge", values.outsideEdge.toFixed(4));
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

function scoreMetrics(metrics) {
  return (
    metrics.edgeProximity * 2.2 +
    metrics.insideEdge * 1.2 +
    metrics.outsideEdge * 1.1 +
    metrics.focusStrength * 0.42
  );
}

function getPacketFade(packet, now) {
  const age = now - packet.startedAt;
  const progress = saturate(age / packet.duration);
  const borderProgress =
    packet.borderProgress ?? LIQUID_GLASS_CONSTANTS.CROSS_BORDER_PROGRESS;

  return (
    smoothstep(0, borderProgress, progress) *
    (1 - smoothstep(borderProgress, 1, progress))
  );
}

function getSurfacePacketCross(surfaceId, packets, now) {
  let cross = 0;
  let direction = 0;

  for (const packet of packets) {
    if (packet.surfaceId !== surfaceId) {
      continue;
    }

    const packetStrength = packet.strength * getPacketFade(packet, now);

    if (packetStrength > cross) {
      cross = packetStrength;
      direction = packet.direction;
    }
  }

  return { cross, direction };
}

function emitCrossPacket(surface, metrics, pointer, now, reducedMotion) {
  if (reducedMotion) {
    return null;
  }

  const boundaryViewportX = surface.rect.left + metrics.boundaryX;
  const boundaryViewportY = surface.rect.top + metrics.boundaryY;
  const normalSpeed = Math.abs(metrics.normalVelocity);
  const direction = metrics.normalVelocity >= 0 ? 1 : -1;
  const boundaryDistance =
    direction > 0 && metrics.d < 0
      ? -metrics.d
      : direction < 0 && metrics.d > 0
        ? metrics.d
        : 0;
  const leadMs =
    normalSpeed > 1
      ? clamp(
          (boundaryDistance / normalSpeed) * 1000,
          0,
          LIQUID_GLASS_CONSTANTS.CROSS_LEAD_MAX_MS
        )
      : 0;
  const borderProgress = LIQUID_GLASS_CONSTANTS.CROSS_BORDER_PROGRESS;
  const speedStrength = saturate(normalSpeed / 850);
  const edgeStrength =
    1 - smoothstep(0, LIQUID_GLASS_CONSTANTS.CROSS_PRE_CAPTURE, metrics.absD);

  return {
    surfaceId: surface.id,
    x: boundaryViewportX,
    y: boundaryViewportY,
    normalX: metrics.normalX,
    normalY: metrics.normalY,
    tangentX: -metrics.normalY,
    tangentY: metrics.normalX,
    direction,
    strength: clamp(0.46 + speedStrength * 0.62 + edgeStrength * 0.24, 0, 1),
    borderProgress,
    startedAt: now + leadMs - LIQUID_GLASS_CONSTANTS.CROSS_DURATION_MS * borderProgress,
    duration: LIQUID_GLASS_CONSTANTS.CROSS_DURATION_MS,
    velocityX: pointer.velocityX,
    velocityY: pointer.velocityY,
  };
}

function maybeCreateCrossPacket(surface, metrics, pointer, now, reducedMotion) {
  if (surface.prevD === null || surface.prevD === undefined) {
    return null;
  }

  if (now - surface.lastCrossAt < 180) {
    return null;
  }

  const previousSign = Math.sign(surface.prevD);
  const currentSign = Math.sign(metrics.d);
  const crossed = previousSign !== 0 && currentSign !== 0 && previousSign !== currentSign;
  const movingTowardBoundary =
    (metrics.d < 0 && metrics.normalVelocity > LIQUID_GLASS_CONSTANTS.CROSS_VELOCITY_MIN) ||
    (metrics.d > 0 && metrics.normalVelocity < -LIQUID_GLASS_CONSTANTS.CROSS_VELOCITY_MIN);
  const enteredCapture =
    surface.prevAbsD > LIQUID_GLASS_CONSTANTS.CROSS_PRE_CAPTURE &&
    metrics.absD <= LIQUID_GLASS_CONSTANTS.CROSS_PRE_CAPTURE &&
    movingTowardBoundary &&
    Math.abs(metrics.normalVelocity) >= LIQUID_GLASS_CONSTANTS.CROSS_VELOCITY_MIN;

  if (!crossed && !enteredCapture) {
    return null;
  }

  surface.lastCrossAt = now;
  return emitCrossPacket(surface, metrics, pointer, now, reducedMotion);
}

function computeSpillForSurface(surface, source, options) {
  const rect = surface.rect;
  const width = rect.width;
  const height = rect.height;
  const localX = source.x - rect.left - width * 0.5;
  const localY = source.y - rect.top - height * 0.5;
  const radius = clamp(surface.radius, 0, Math.min(width, height) * 0.5);
  const d = sdRoundedRect(localX, localY, width, height, radius);
  const spillDistance = Math.abs(d);
  const spillFalloff = 1 - smoothstep(0, options.spillRadius, spillDistance);

  if (spillFalloff <= 0) {
    return null;
  }

  const { nx, ny } = computeSdfGradient(localX, localY, width, height, radius);
  const boundary = computeBoundaryPointFromSdf(localX, localY, d, nx, ny);
  const boundaryX = boundary.x + width * 0.5;
  const boundaryY = boundary.y + height * 0.5;
  const angleBias = 0.74 + 0.26 * Math.abs(source.normalX * nx + source.normalY * ny);
  const strength = saturate(spillFalloff * source.strength * angleBias * 0.34);

  return {
    strength,
    boundaryX,
    boundaryY,
    boundaryPercentX: toPercent(boundaryX, width, options.overscan * 0.25),
    boundaryPercentY: toPercent(boundaryY, height, options.overscan * 0.25),
    normalX: nx,
    normalY: ny,
  };
}

function makeTargetValues(surface, entry, packets, now) {
  const metrics = entry?.metrics;
  const spill = entry?.spill;
  const packetCross = getSurfacePacketCross(surface.id, packets, now);
  const isPrimary = Boolean(entry?.primary);
  const width = surface.rect?.width || 1;
  const height = surface.rect?.height || 1;
  const base = surface.render || createRenderValues();
  const visual = spill && !isPrimary ? spill : metrics;
  const cross = packetCross.cross;
  const crossDir = packetCross.direction;

  if (!visual) {
    return {
      ...base,
      edge: 0,
      insideEdge: 0,
      outsideEdge: 0,
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
  const outerOffset = 10 + 16 * Math.max(metrics?.outsideEdge || 0, spill?.strength || 0, cross);
  const primaryActive = isPrimary
    ? saturate(
        (metrics.d <= 0 ? 0.16 : 0.14) +
          metrics.edgeProximity * 0.5 +
          metrics.insideEdge * 0.12 +
          metrics.outsideEdge * 0.18
      )
    : 0;
  const spillStrength = spill?.strength || 0;

  return {
    localX: metrics?.localPercentX ?? base.localX,
    localY: metrics?.localPercentY ?? base.localY,
    boundaryX: visual.boundaryPercentX,
    boundaryY: visual.boundaryPercentY,
    outerX: getOuterPercent(visual.boundaryX, visual.normalX, width, outerOffset),
    outerY: getOuterPercent(visual.boundaryY, visual.normalY, height, outerOffset),
    boundaryViewportX,
    boundaryViewportY,
    normalX: visual.normalX,
    normalY: visual.normalY,
    d: metrics?.d ?? base.d,
    edge: isPrimary ? metrics.edgeProximity : spillStrength * 0.22,
    insideEdge: isPrimary ? metrics.insideEdge : 0,
    outsideEdge: isPrimary ? metrics.outsideEdge : spillStrength,
    cross,
    crossDir,
    spill: spillStrength,
    active: saturate(Math.max(primaryActive, spillStrength * 0.88, cross)),
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
  current.normalX = lerp(current.normalX, target.normalX, t);
  current.normalY = lerp(current.normalY, target.normalY, t);
  current.d = lerp(current.d, target.d, t);
  current.edge = lerp(current.edge, target.edge, t);
  current.insideEdge = lerp(current.insideEdge, target.insideEdge, t);
  current.outsideEdge = lerp(current.outsideEdge, target.outsideEdge, t);
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
    current.cross,
    current.spill
  );
}

function drawEllipse(ctx, x, y, radiusX, radiusY, rotation, alpha) {
  if (alpha <= 0.001) {
    return;
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(radiusX, radiusY);

  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, `rgba(255, 255, 255, ${0.82 * alpha})`);
  gradient.addColorStop(0.24, `rgba(238, 238, 238, ${0.32 * alpha})`);
  gradient.addColorStop(0.52, `rgba(176, 176, 176, ${0.22 * alpha})`);
  gradient.addColorStop(0.76, `rgba(72, 72, 72, ${0.08 * alpha})`);
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function getBoundarySlide(progress, direction, borderProgress) {
  const insideDistance = 30;
  const outsideDistance = 24;

  if (progress <= borderProgress) {
    const t = saturate(progress / borderProgress);

    return direction * -insideDistance * (1 - t * t);
  }

  const t = saturate((progress - borderProgress) / (1 - borderProgress));

  return direction * outsideDistance * (1 - (1 - t) * (1 - t));
}

function drawFlowPacket(ctx, packet, now) {
  const fade = getPacketFade(packet, now);

  if (fade <= 0.001) {
    return;
  }

  const progress = saturate((now - packet.startedAt) / packet.duration);
  const borderProgress =
    packet.borderProgress ?? LIQUID_GLASS_CONSTANTS.CROSS_BORDER_PROGRESS;
  const slide = getBoundarySlide(progress, packet.direction, borderProgress);
  const x = packet.x + packet.normalX * slide;
  const y = packet.y + packet.normalY * slide;
  const rotation = Math.atan2(packet.normalY, packet.normalX);
  const alpha = packet.strength * fade;

  drawEllipse(ctx, x, y, 68, 22, rotation, alpha);

  ctx.save();
  ctx.globalAlpha = alpha * 0.34;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 1.1;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - packet.normalX * 22, y - packet.normalY * 22);
  ctx.lineTo(x + packet.normalX * 22, y + packet.normalY * 22);
  ctx.stroke();
  ctx.restore();
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

function drawFieldOverlay(canvas, surfaces, packets, now, reducedMotion) {
  const ctx = prepareCanvas(canvas);

  if (!ctx) {
    return;
  }

  ctx.globalCompositeOperation = "screen";

  for (const surface of surfaces) {
    const values = surface.render;

    if (!values) {
      continue;
    }

    const intensity = surface.intensity ?? 1;
    const strength =
      (values.outsideEdge * 0.46 +
        values.insideEdge * 0.1 +
        values.spill * 0.68 +
        values.cross * 1.12) *
      values.active *
      intensity *
      (reducedMotion ? 0.45 : 1);

    if (strength <= 0.008) {
      continue;
    }

    const x = values.boundaryViewportX + values.normalX * 10;
    const y = values.boundaryViewportY + values.normalY * 10;
    const rotation = Math.atan2(values.normalY, values.normalX);
    const radiusX = 70 + 54 * strength;
    const radiusY = 22 + 20 * strength;

    drawEllipse(ctx, x, y, radiusX, radiusY, rotation, saturate(strength), 0);
  }

  if (!reducedMotion) {
    for (const packet of packets) {
      drawFlowPacket(ctx, packet, now);
    }
  }

  ctx.globalCompositeOperation = "source-over";
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
  const packetsRef = useRef([]);
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
      let focusEntry = null;

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
          const inOverscan = metrics.d <= 0 || metrics.absD <= options.overscan;
          const score = inOverscan ? scoreMetrics(metrics) : 0;
          const entry = {
            surface,
            metrics,
            score,
            primary: false,
            spill: null,
          };

          entries.set(surface.id, entry);

          if (score > 0 && surface.interactive !== false) {
            candidateEntries.push(entry);
          }
        }

        candidateEntries.sort((a, b) => b.score - a.score);
        focusEntry = candidateEntries[0] || null;

        for (const entry of candidateEntries.slice(0, options.maxActiveSurfaces)) {
          entry.primary = true;
        }
      }

      if (focusEntry) {
        const source = {
          x: focusEntry.surface.rect.left + focusEntry.metrics.boundaryX,
          y: focusEntry.surface.rect.top + focusEntry.metrics.boundaryY,
          normalX: focusEntry.metrics.normalX,
          normalY: focusEntry.metrics.normalY,
          strength: saturate(
            0.28 +
              focusEntry.metrics.edgeProximity * 0.62 +
              focusEntry.metrics.outsideEdge * 0.18 +
              focusEntry.metrics.insideEdge * 0.16
          ),
        };

        for (const entry of entries.values()) {
          if (entry.surface.id === focusEntry.surface.id) {
            continue;
          }

          entry.spill = computeSpillForSurface(entry.surface, source, options);
        }
      }

      const newPackets = [];

      for (const entry of entries.values()) {
        const { surface, metrics } = entry;

        if (entry.primary) {
          const packet = maybeCreateCrossPacket(
            surface,
            metrics,
            pointer,
            now,
            reducedMotionRef.current
          );

          if (packet) {
            newPackets.push(packet);
          }
        }

        surface.prevD = metrics.d;
        surface.prevAbsD = metrics.absD;
      }

      packetsRef.current = [...packetsRef.current, ...newPackets]
        .filter((packet) => now - packet.startedAt <= packet.duration)
        .slice(-10);

      let maxActivity = packetsRef.current.length > 0 ? 1 : 0;

      for (const surface of surfaces) {
        const target = makeTargetValues(
          surface,
          entries.get(surface.id),
          packetsRef.current,
          now
        );

        maxActivity = Math.max(
          maxActivity,
          advanceSurfaceRender(surface, target, reducedMotionRef.current)
        );
      }

      drawFieldOverlay(
        overlayRef.current,
        surfaces,
        packetsRef.current,
        now,
        reducedMotionRef.current
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

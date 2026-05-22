import { useEffect, useRef } from "react";

const DEFAULT_RADIUS = 28;
const CENTER_PERCENT = 50;
const POINTER_SMOOTHING = 0.2;
const ACTIVE_SMOOTHING = 0.16;
const REST_EPSILON = 0.01;
const MAX_INFLUENCE_DISTANCE = 180;
const MIN_INFLUENCE_DISTANCE = 72;

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }

  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function roundedRectSignedDistance(localX, localY, width, height, radius) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const innerHalfWidth = Math.max(0, halfWidth - radius);
  const innerHalfHeight = Math.max(0, halfHeight - radius);

  const qx = Math.abs(localX) - innerHalfWidth;
  const qy = Math.abs(localY) - innerHalfHeight;
  const outsideX = Math.max(qx, 0);
  const outsideY = Math.max(qy, 0);
  const outsideDistance = Math.hypot(outsideX, outsideY);
  const insideDistance = Math.min(Math.max(qx, qy), 0);

  return outsideDistance + insideDistance - radius;
}

function estimateRoundedRectNormal(localX, localY, width, height, radius) {
  const epsilon = 0.5;
  const dx =
    roundedRectSignedDistance(localX + epsilon, localY, width, height, radius) -
    roundedRectSignedDistance(localX - epsilon, localY, width, height, radius);
  const dy =
    roundedRectSignedDistance(localX, localY + epsilon, width, height, radius) -
    roundedRectSignedDistance(localX, localY - epsilon, width, height, radius);
  const length = Math.hypot(dx, dy);

  if (length > 0.0001) {
    return {
      x: dx / length,
      y: dy / length,
    };
  }

  const fallbackLength = Math.hypot(localX, localY) || 1;

  return {
    x: localX / fallbackLength,
    y: localY / fallbackLength,
  };
}

function toPercent(value, size) {
  if (size <= 0) {
    return CENTER_PERCENT;
  }

  return clamp((value / size) * 100, -12, 112);
}

function toSignedUnit(value, size) {
  if (size <= 0) {
    return 0;
  }

  return clamp((value / size) * 2 - 1, -1, 1);
}

export function calculateRoundedRectGlassValues(element, pointerEvent, radius) {
  const rect = element.getBoundingClientRect();
  const width = Math.max(rect.width, 1);
  const height = Math.max(rect.height, 1);
  const maxRadius = Math.min(width, height) / 2;
  const resolvedRadius = clamp(radius ?? DEFAULT_RADIUS, 0, maxRadius);

  const x = clamp(pointerEvent.clientX - rect.left, -width, width * 2);
  const y = clamp(pointerEvent.clientY - rect.top, -height, height * 2);
  const localX = x - width / 2;
  const localY = y - height / 2;

  const signedDistance = roundedRectSignedDistance(
    localX,
    localY,
    width,
    height,
    resolvedRadius
  );
  const normal = estimateRoundedRectNormal(
    localX,
    localY,
    width,
    height,
    resolvedRadius
  );

  // Project along the SDF normal to estimate the nearest rounded-rect boundary.
  // This keeps edge highlights continuous through corners instead of snapping
  // between top, right, bottom, and left edges.
  const edgeLocalX = localX - signedDistance * normal.x;
  const edgeLocalY = localY - signedDistance * normal.y;
  const edgeX = edgeLocalX + width / 2;
  const edgeY = edgeLocalY + height / 2;

  const influenceDistance = clamp(
    Math.min(width, height) * 0.48,
    MIN_INFLUENCE_DISTANCE,
    MAX_INFLUENCE_DISTANCE
  );
  const distance = 1 - smoothstep(0, influenceDistance, Math.abs(signedDistance));

  return {
    x: toPercent(x, width),
    y: toPercent(y, height),
    cursorX: toSignedUnit(x, width),
    cursorY: toSignedUnit(y, height),
    edgeX: toPercent(edgeX, width),
    edgeY: toPercent(edgeY, height),
    distance: clamp(distance, 0, 1),
    signedDistance,
    isInside: signedDistance <= 0,
  };
}

function createInitialValues() {
  return {
    x: CENTER_PERCENT,
    y: CENTER_PERCENT,
    cursorX: 0,
    cursorY: 0,
    edgeX: CENTER_PERCENT,
    edgeY: CENTER_PERCENT,
    distance: 0,
    active: 0,
  };
}

function writeGlassVariables(element, values) {
  element.style.setProperty("--glass-x", `${values.x.toFixed(2)}%`);
  element.style.setProperty("--glass-y", `${values.y.toFixed(2)}%`);
  element.style.setProperty("--glass-cursor-x", values.cursorX.toFixed(4));
  element.style.setProperty("--glass-cursor-y", values.cursorY.toFixed(4));
  element.style.setProperty("--glass-edge-x", `${values.edgeX.toFixed(2)}%`);
  element.style.setProperty("--glass-edge-y", `${values.edgeY.toFixed(2)}%`);
  element.style.setProperty("--glass-distance", values.distance.toFixed(4));
  element.style.setProperty("--glass-active", values.active.toFixed(4));
}

function valuesAreSettled(current, target) {
  return (
    Math.abs(current.x - target.x) < REST_EPSILON &&
    Math.abs(current.y - target.y) < REST_EPSILON &&
    Math.abs(current.edgeX - target.edgeX) < REST_EPSILON &&
    Math.abs(current.edgeY - target.edgeY) < REST_EPSILON &&
    Math.abs(current.distance - target.distance) < REST_EPSILON &&
    Math.abs(current.active - target.active) < REST_EPSILON
  );
}

export function useLiquidGlassPointer({ radius = DEFAULT_RADIUS, intensity = 1 } = {}) {
  const elementRef = useRef(null);
  const frameRef = useRef(null);
  const currentRef = useRef(createInitialValues());
  const targetRef = useRef(createInitialValues());

  useEffect(() => {
    const element = elementRef.current;

    if (!element) {
      return undefined;
    }

    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    element.style.setProperty("--glass-radius", `${radius}px`);
    element.style.setProperty("--glass-intensity", String(intensity));
    writeGlassVariables(element, currentRef.current);

    if (reducedMotionQuery.matches) {
      return undefined;
    }

    function animate() {
      const current = currentRef.current;
      const target = targetRef.current;

      current.x = lerp(current.x, target.x, POINTER_SMOOTHING);
      current.y = lerp(current.y, target.y, POINTER_SMOOTHING);
      current.cursorX = lerp(current.cursorX, target.cursorX, POINTER_SMOOTHING);
      current.cursorY = lerp(current.cursorY, target.cursorY, POINTER_SMOOTHING);
      current.edgeX = lerp(current.edgeX, target.edgeX, POINTER_SMOOTHING);
      current.edgeY = lerp(current.edgeY, target.edgeY, POINTER_SMOOTHING);
      current.distance = lerp(current.distance, target.distance, POINTER_SMOOTHING);
      current.active = lerp(current.active, target.active, ACTIVE_SMOOTHING);

      writeGlassVariables(element, current);

      if (valuesAreSettled(current, target)) {
        Object.assign(current, target);
        writeGlassVariables(element, current);
        frameRef.current = null;
        return;
      }

      frameRef.current = requestAnimationFrame(animate);
    }

    function requestFrame() {
      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(animate);
      }
    }

    function updateFromPointer(event) {
      const values = calculateRoundedRectGlassValues(element, event, radius);

      targetRef.current = {
        ...targetRef.current,
        ...values,
        active: 1,
      };

      requestFrame();
    }

    function handlePointerLeave() {
      targetRef.current = {
        x: CENTER_PERCENT,
        y: CENTER_PERCENT,
        cursorX: 0,
        cursorY: 0,
        edgeX: CENTER_PERCENT,
        edgeY: CENTER_PERCENT,
        distance: 0,
        active: 0,
      };

      requestFrame();
    }

    element.addEventListener("pointerenter", updateFromPointer);
    element.addEventListener("pointermove", updateFromPointer);
    element.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      element.removeEventListener("pointerenter", updateFromPointer);
      element.removeEventListener("pointermove", updateFromPointer);
      element.removeEventListener("pointerleave", handlePointerLeave);

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [radius, intensity]);

  return elementRef;
}

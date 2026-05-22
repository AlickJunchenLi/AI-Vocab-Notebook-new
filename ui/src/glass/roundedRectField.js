export const LIQUID_GLASS_CONSTANTS = {
  EDGE_WIDTH: 26,
  INNER_RANGE: 56,
  OUTER_RANGE: 76,
  FOCUS_RANGE: 132,
  GROUP_OVERSCAN: 132,
  SPILL_RADIUS: 200,
  CROSS_CAPTURE: 18,
  CROSS_PRE_CAPTURE: 40,
  CROSS_BORDER_PROGRESS: 0.44,
  CROSS_LEAD_MAX_MS: 120,
  CROSS_DURATION_MS: 280,
  CROSS_VELOCITY_MIN: 56,
  POINTER_SMOOTHING: 0.12,
  VELOCITY_SMOOTHING: 0.16,
  HIGHLIGHT_LERP: 0.13,
  BRIDGE_MIN_LENGTH: 28,
  BRIDGE_MAX_LENGTH: 118,
  BRIDGE_EDGE_BULB: 22,
  MAX_ACTIVE_SURFACES: 6,
};

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function inverseLerp(a, b, value) {
  if (a === b) {
    return value < a ? 0 : 1;
  }

  return (value - a) / (b - a);
}

export function saturate(value) {
  return clamp(value, 0, 1);
}

export function smoothstep(edge0, edge1, value) {
  const x = saturate(inverseLerp(edge0, edge1, value));
  return x * x * (3 - 2 * x);
}

export function length2(x, y) {
  return Math.hypot(x, y);
}

export function sdRoundedRect(px, py, width, height, radius) {
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  const safeRadius = clamp(radius, 0, Math.min(safeWidth, safeHeight) * 0.5);
  const bx = safeWidth * 0.5 - safeRadius;
  const by = safeHeight * 0.5 - safeRadius;
  const qx = Math.abs(px) - bx;
  const qy = Math.abs(py) - by;
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);

  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - safeRadius;
}

export function computeSdfGradient(
  px,
  py,
  width,
  height,
  radius,
  epsilon = 0.5
) {
  const dx =
    sdRoundedRect(px + epsilon, py, width, height, radius) -
    sdRoundedRect(px - epsilon, py, width, height, radius);
  const dy =
    sdRoundedRect(px, py + epsilon, width, height, radius) -
    sdRoundedRect(px, py - epsilon, width, height, radius);
  const gradientLength = length2(dx, dy);

  if (gradientLength > 0.0001) {
    return {
      nx: dx / gradientLength,
      ny: dy / gradientLength,
    };
  }

  const fallbackLength = length2(px, py) || 1;

  return {
    nx: px / fallbackLength,
    ny: py / fallbackLength,
  };
}

export function computeBoundaryPointFromSdf(px, py, d, nx, ny) {
  return {
    x: px - d * nx,
    y: py - d * ny,
  };
}

function toPercent(value, size, overscan = 0) {
  const safeSize = Math.max(size, 1);
  const overscanPercent = (overscan / safeSize) * 100;

  return clamp((value / safeSize) * 100, -overscanPercent, 100 + overscanPercent);
}

export function computeSurfaceMetrics(
  pointerX,
  pointerY,
  rect,
  radius,
  velocity = { x: 0, y: 0 },
  constants = LIQUID_GLASS_CONSTANTS
) {
  const width = Math.max(rect.width, 1);
  const height = Math.max(rect.height, 1);
  const resolvedRadius = clamp(radius, 0, Math.min(width, height) * 0.5);
  const elementX = pointerX - rect.left;
  const elementY = pointerY - rect.top;
  const localX = elementX - width * 0.5;
  const localY = elementY - height * 0.5;
  const d = sdRoundedRect(localX, localY, width, height, resolvedRadius);
  const absD = Math.abs(d);
  const { nx, ny } = computeSdfGradient(
    localX,
    localY,
    width,
    height,
    resolvedRadius
  );
  const boundary = computeBoundaryPointFromSdf(localX, localY, d, nx, ny);
  const boundaryX = boundary.x + width * 0.5;
  const boundaryY = boundary.y + height * 0.5;
  const tangentX = -ny;
  const tangentY = nx;
  const normalVelocity = velocity.x * nx + velocity.y * ny;
  const tangentVelocity = velocity.x * tangentX + velocity.y * tangentY;
  const edgeProximity = 1 - smoothstep(0, constants.EDGE_WIDTH, absD);
  const insideEdge =
    d <= 0 ? 1 - smoothstep(0, constants.INNER_RANGE, -d) : 0;
  const outsideEdge =
    d >= 0 ? 1 - smoothstep(0, constants.OUTER_RANGE, d) : 0;
  const focusStrength = 1 - smoothstep(0, constants.FOCUS_RANGE, Math.max(d, 0));
  const active = 1 - smoothstep(0, constants.FOCUS_RANGE, absD);

  /*
   * A signed-distance field returns the distance to the rounded rectangle:
   * negative means the pointer is inside, positive means it is outside, and
   * zero is the border. The gradient of that field points outward, so moving
   * from the pointer back by d * normal gives a smooth boundary anchor. Because
   * the anchor comes from the same field as the distance, corners blend without
   * snapping to a chosen top/left/right side.
   */
  return {
    d,
    absD,
    edgeProximity: saturate(edgeProximity),
    insideEdge: saturate(insideEdge),
    outsideEdge: saturate(outsideEdge),
    focusStrength: saturate(focusStrength),
    boundaryX,
    boundaryY,
    boundaryPercentX: toPercent(boundaryX, width, constants.GROUP_OVERSCAN * 0.25),
    boundaryPercentY: toPercent(boundaryY, height, constants.GROUP_OVERSCAN * 0.25),
    normalX: nx,
    normalY: ny,
    rectWidth: width,
    rectHeight: height,
    localX,
    localY,
    elementX,
    elementY,
    localPercentX: toPercent(elementX, width, constants.GROUP_OVERSCAN),
    localPercentY: toPercent(elementY, height, constants.GROUP_OVERSCAN),
    velocityX: velocity.x,
    velocityY: velocity.y,
    normalVelocity,
    tangentVelocity,
    crossingStrength: 0,
    spillStrength: 0,
    active: saturate(active),
  };
}

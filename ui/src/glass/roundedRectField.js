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

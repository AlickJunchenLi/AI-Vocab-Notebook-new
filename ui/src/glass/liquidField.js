import { smoothstep } from "./roundedRectField.js";

/*
 * The liquid layer's model, in one place.
 *
 * The glass is a slab whose rim is a bevel. Near an edge the pointer presses a
 * shallow dent into it: the dent is a disc carved out of the slab with a
 * smooth maximum, so once the dent gets close to the rim the two slopes merge
 * through a soft neck instead of meeting at a crease. Everything visible is
 * lighting on that height field, which the shader evaluates per pixel, so no
 * part of it depends on picking a single "nearest edge".
 *
 * The same numbers drive the shader uniforms and the tuning page.
 */
export const LIQUID_DEFAULTS = {
  // How far inside the rim the dent starts to form, and how far outside the
  // rim it still pushes on the edge.
  reach: 130,
  outsideReach: 44,
  // Dent size and depth at full strength; depth is a fraction of the bevel
  // height. Softness is the width of the dent's sloping wall, inside its
  // radius.
  dentRadius: 52,
  dentDepth: 0.8,
  dentSoftness: 30,
  // Width of the smooth blend that forms the neck between dent and rim.
  neck: 34,
  // Bevel width across the surface, and its height, which sets how steep
  // the slopes look to the light.
  bevel: 20,
  bevelHeight: 12,
  // The lamp sits this far above the pointer; falloff is where its light has
  // dropped to half.
  lightHeight: 80,
  falloff: 110,
  glow: 0.8,
  specular: 0.9,
  shininess: 36,
  shade: 0.3,
  caustic: 0.35,
  // How much a moving dent stretches along its direction of travel.
  stretch: 0.35,
  // Underdamped on purpose: the dent overshoots a little, which reads as
  // liquid. Critical damping for this stiffness would be about 26.
  springStiffness: 170,
  springDamping: 15,
  // Cap on canvas pixels per CSS pixel; large panels are the expensive case.
  pixelRatio: 2,
  // Distance from the rim over which the layer as a whole fades in.
  presence: 240,
};

// Quadratic smooth maximum (the mirror of Inigo Quilez's polynomial smin).
export function smoothMax(a, b, k) {
  if (k <= 0) return Math.max(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

/*
 * How strongly the pointer presses, from its signed distance to the rim
 * (negative inside). 1 at the rim, easing to 0 by `reach` inside and by
 * `outsideReach` outside, so the dent is invisible deep inside a surface.
 */
export function pressStrength(distance, reach, outsideReach) {
  if (distance >= 0) {
    return outsideReach > 0 ? 1 - smoothstep(0, outsideReach, distance) : 0;
  }
  return 1 - smoothstep(0, reach, -distance);
}

// Frame-rate independent exponential ease, snapping once it is close enough.
export function approach(current, target, rate, delta, epsilon = 0.001) {
  const next = current + (target - current) * (1 - Math.exp(-rate * delta));
  return Math.abs(next - target) < epsilon ? target : next;
}

// How visible the layer is overall, whichever side of the rim the pointer is.
export function layerPresence(distance, range) {
  return 1 - smoothstep(0, range, Math.abs(distance));
}

/*
 * Critically damped follow for the pointer itself: it eases into motion but
 * never overshoots, so the light tracks without wobbling.
 */
export function followAxis(axis, target, smoothTime, delta) {
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

/*
 * Underdamped spring for the dent. Integrated in small fixed steps so it stays
 * stable at any frame rate. Returns true while it is still moving.
 */
export function stepSpring(spring, target, stiffness, damping, delta) {
  let remaining = delta;
  while (remaining > 0) {
    const step = Math.min(remaining, 1 / 240);
    const acceleration = stiffness * (target - spring.value) - damping * spring.velocity;
    spring.velocity += acceleration * step;
    spring.value += spring.velocity * step;
    remaining -= step;
  }
  if (Math.abs(spring.value - target) < 0.0005 && Math.abs(spring.velocity) < 0.005) {
    spring.value = target;
    spring.velocity = 0;
    return false;
  }
  return true;
}

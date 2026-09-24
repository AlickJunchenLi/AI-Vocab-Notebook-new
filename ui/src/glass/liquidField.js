import { clamp, sdRoundedRect, smoothstep } from "./roundedRectField.js";

/*
 * The liquid layer's model, in one place.
 *
 * The glass is a slab whose rim is a bevel. As the pointer nears an edge, the
 * rim there swells and sends a liquid trace towards the pointer: light
 * gathered in the glass that flares where it clings to the rim and thins to a
 * tip just short of the pointer, so nothing is drawn around the pointer
 * itself. Everything visible is lighting on that height field, which the
 * shader evaluates per pixel, so no part of it depends on picking a single
 * "nearest edge".
 *
 * The same numbers drive the shader uniforms and the tuning page.
 */
export const LIQUID_DEFAULTS = {
  // How far inside the rim the pointer still draws a trace, and how far
  // outside it the rim still swells towards the pointer.
  reach: 130,
  outsideReach: 44,
  // Half-width of the trace where it leaves the rim, how bright it is, how
  // far short of the pointer it stops, how softly its body fades to its
  // sides, the fine bright line along its edge, and the faint shade outside
  // that line. By default the trace is a soft streak of light with no edge
  // line or shade: any contour turns it into a shape stuck on the glass.
  traceWidth: 26,
  traceStrength: 1.1,
  tipGap: 10,
  traceWall: 24,
  traceEdge: 0,
  traceShade: 0,
  // How much the rim nearest the pointer swells (1 doubles its bevel width),
  // and how far along the rim the swell spreads.
  swell: 0.8,
  swellWidth: 55,
  // Bevel width across the surface, and its height, which sets how steep
  // the slopes look to the light.
  bevel: 20,
  bevelHeight: 12,
  // The lamp sits this far above the pointer; falloff is where its light has
  // dropped to half.
  lightHeight: 80,
  falloff: 110,
  // The rim highlight's bright band, and the darker hairline outside it.
  glow: 0.8,
  edgeContrast: 0.45,
  specular: 0.9,
  shininess: 36,
  caustic: 0.35,
  // The trace follows the pointer on an underdamped spring, so it lags and
  // overshoots a little like liquid. Critical damping here would be about 26.
  springStiffness: 170,
  springDamping: 15,
  // Cap on canvas pixels per CSS pixel; large panels are the expensive case.
  pixelRatio: 2,
  // Distance from the rim over which the layer as a whole fades in.
  presence: 240,
};

/*
 * Each side of the rounded rectangle, as a map into that side's own frame:
 * `along` runs the length of the side and `depth` points into the glass. A
 * side owns its straight edge plus the half of each corner arc next to it, so
 * the four sides share the whole rim between them.
 */
const SIDES = [
  { // top
    toSide: (x, y) => [x, y],
    fromSide: (along, depth) => [along, depth],
    length: (width) => width,
  },
  { // right
    toSide: (x, y, width) => [y, width - x],
    fromSide: (along, depth, width) => [width - depth, along],
    length: (width, height) => height,
  },
  { // bottom
    toSide: (x, y, width, height) => [x, height - y],
    fromSide: (along, depth, width, height) => [along, height - depth],
    length: (width) => width,
  },
  { // left
    toSide: (x, y) => [y, x],
    fromSide: (along, depth) => [depth, along],
    length: (width, height) => height,
  },
];

// Nearest point to (along, depth) on one side, in that side's frame.
function nearestOnSide(along, depth, length, radius) {
  if (along >= radius && along <= length - radius) return [along, 0];
  const outward = along < radius ? -1 : 1;
  const centreAlong = along < radius ? radius : length - radius;
  const dx = along - centreAlong;
  const dy = depth - radius;
  const distance = Math.hypot(dx, dy);
  const diagonal = [centreAlong + outward * radius * Math.SQRT1_2, radius - radius * Math.SQRT1_2];
  if (distance < 1e-6) return diagonal;
  const nx = dx / distance;
  const ny = dy / distance;
  // This side's share of the arc runs from straight up to the diagonal.
  if (-ny >= nx * outward) return [centreAlong + nx * radius, radius + ny * radius];
  return diagonal;
}

export const TRACE_COUNT = SIDES.length;

/*
 * The liquid traces for one surface, in its own pixels: one per side, running
 * from that side's nearest rim point towards the anchor and stopping
 * `tipGap` short of it. Only the nearest side draws at full strength; others
 * fade out as they fall behind, so a pointer crossing the middle of a surface
 * hands the trace from one side to the other instead of snapping.
 *
 * Returns `frames` (rim point x, y and unit direction x, y), `shapes`
 * (mouth radius, tip radius, spine length, strength) and `swells` (how much
 * each side's rim swells), ready for the shader. The swell also answers a
 * pointer approaching from outside the glass; the trace only forms inside.
 */
export function computeTraces(anchorX, anchorY, width, height, radius, settings, amount) {
  const safeRadius = clamp(radius, 0, Math.min(width, height) / 2);
  const inside = sdRoundedRect(
    anchorX - width / 2, anchorY - height / 2, width, height, safeRadius,
  ) < 0;
  const candidates = SIDES.map((side) => {
    const [along, depth] = side.toSide(anchorX, anchorY, width, height);
    const [nearAlong, nearDepth] = nearestOnSide(along, depth, side.length(width, height), safeRadius);
    const [x, y] = side.fromSide(nearAlong, nearDepth, width, height);
    return { x, y, distance: Math.hypot(anchorX - x, anchorY - y) };
  });
  const nearest = Math.min(...candidates.map((candidate) => candidate.distance));

  const frames = [];
  const shapes = [];
  const swells = [];
  for (const { x, y, distance } of candidates) {
    const length = distance - settings.tipGap;
    const dominance = 1 - smoothstep(0, settings.traceWidth, distance - nearest);
    const press = inside
      ? 1 - smoothstep(0, settings.reach, distance)
      : 1 - smoothstep(0, Math.max(settings.outsideReach, 0.001), distance);
    swells.push(amount * settings.swell * dominance * press);
    const strength = inside && length > 0.5
      ? amount * settings.traceStrength * dominance * (1 - smoothstep(0, settings.reach, distance))
      : 0;
    // A short trace stays a tongue pointing at the pointer rather than
    // swelling into a half-disc that curves around it.
    const mouth = Math.min(settings.traceWidth, Math.max(length, 0) * 0.6);
    const tip = mouth * 0.35;
    frames.push(distance > 0 ? [x, y, (anchorX - x) / distance, (anchorY - y) / distance] : [x, y, 0, 1]);
    shapes.push([mouth, tip, Math.max(length - tip, mouth - tip + 0.01), strength]);
  }
  return { frames, shapes, swells };
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
 * Underdamped spring for the trace's anchor. Integrated in small fixed steps
 * so it stays stable at any frame rate. Returns true while it is still moving.
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
  if (Math.abs(spring.value - target) < 0.05 && Math.abs(spring.velocity) < 0.5) {
    spring.value = target;
    spring.velocity = 0;
    return false;
  }
  return true;
}

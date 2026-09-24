import { clamp, sdRoundedRect, smoothstep } from "./roundedRectField.js";

/*
 * The liquid layer's model, in one place.
 *
 * The glass is a slab whose rim is a bevel. As the pointer nears an edge, the
 * rim there swells and its highlight brightens; nothing is drawn around the
 * pointer itself. The rim can also send a liquid trace towards the pointer
 * (light gathered in the glass, flared where it clings to the rim and thinning
 * to a tip just short of the pointer), but that is off by default. Everything
 * visible is lighting on that height field, which the shader evaluates per
 * pixel, so no part of it depends on picking a single "nearest edge".
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
  // that line. The trace is off by default (strength 0): the pointer's effect
  // stays on the rim itself. Raise the strength to bring it back as a soft
  // streak of light; any edge line or shade turns it into a shape stuck on
  // the glass.
  traceWidth: 26,
  traceStrength: 0,
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

// The four sides: top, right, bottom, left.
export const SIDE_COUNT = 4;

/*
 * The four sides as seen from (x, y): how far away each side's line is, which
 * way it faces, and the nearest point on its straight edge (clamped short of
 * the corner arcs, so it slides smoothly as the point moves).
 */
function sidesFrom(x, y, width, height, radius) {
  const alongX = clamp(x, radius, width - radius);
  const alongY = clamp(y, radius, height - radius);
  return [
    { line: y, normal: [0, -1], point: [alongX, 0] },
    { line: width - x, normal: [1, 0], point: [width, alongY] },
    { line: height - y, normal: [0, 1], point: [alongX, height] },
    { line: x, normal: [-1, 0], point: [0, alongY] },
  ];
}

/*
 * The liquid effect for one surface, in its own pixels.
 *
 * The rim swells on every side near the anchor. The trace is always a single
 * one. Every side pulls it towards itself, more the closer it is, so it runs
 * straight out of an edge that is clearly nearest, comes out of the corner
 * when two edges are equally near, and fades away where opposite edges pull
 * equally (the middle of a thin bar or button). Its start is where that
 * direction meets the rim, and it stops `tipGap` short of the anchor.
 * Everything here changes smoothly as the anchor moves, so the trace never
 * jumps.
 *
 * `traceAmount` scales only the trace, so a surface can keep its rim light
 * while another surface draws the trace.
 *
 * Returns `frame` (rim point x, y and unit direction x, y) and `shape` (mouth
 * radius, tip radius, spine length, strength) for the trace, and `swellPoints`
 * and `swells` (each side's rim point and how much it swells), ready for the
 * shader. The swell also answers a pointer approaching from outside the
 * glass; the trace only forms inside.
 */
export function computeTraces(
  anchorX, anchorY, width, height, radius, settings, amount, traceAmount = amount,
) {
  const safeRadius = clamp(radius, 0, Math.min(width, height) / 2);
  const rim = sdRoundedRect(anchorX - width / 2, anchorY - height / 2, width, height, safeRadius);
  const inside = rim < 0;
  const sides = sidesFrom(anchorX, anchorY, width, height, safeRadius);

  const distances = sides.map(({ point }) => Math.hypot(anchorX - point[0], anchorY - point[1]));
  const nearest = Math.min(...distances);
  // The swell reaches `reach` inside the glass and `outsideReach` outside it,
  // blending between the two across the rim so crossing it changes nothing.
  const swellReach = Math.max(
    settings.outsideReach + (settings.reach - settings.outsideReach) * smoothstep(-8, 8, -rim),
    0.001,
  );
  const swellPoints = sides.map(({ point }) => point);
  const swells = distances.map((distance) => {
    const closeness = 1 - smoothstep(0, settings.traceWidth, distance - nearest);
    return amount * settings.swell * closeness * (1 - smoothstep(0, swellReach, distance));
  });

  // Each side pulls with a weight that falls off as it gets farther than the
  // nearest one; the pulls add up to the trace's direction out to the rim.
  const nearestLine = Math.min(...sides.map(({ line }) => line));
  const softness = settings.traceWidth / 3;
  let pullX = 0;
  let pullY = 0;
  let total = 0;
  for (const { line, normal } of sides) {
    const weight = Math.exp(-(line - nearestLine) / softness);
    pullX += weight * normal[0];
    pullY += weight * normal[1];
    total += weight;
  }
  const pull = Math.hypot(pullX, pullY);
  // How decided the pull is: 1 for a single edge, about 0.7 at a corner, and
  // 0 where opposite edges cancel out.
  const fade = smoothstep(0.15, 0.65, pull / total);
  const outX = pull > 1e-9 ? pullX / pull : 0;
  const outY = pull > 1e-9 ? pullY / pull : -1;

  // Walk from the anchor along that direction out to the rim.
  let reach = 0;
  for (let step = 0; step < 48; step++) {
    const inward = -sdRoundedRect(
      anchorX + outX * reach - width / 2, anchorY + outY * reach - height / 2, width, height, safeRadius,
    );
    if (inward < 0.01) break;
    reach += inward;
  }
  const x = anchorX + outX * reach;
  const y = anchorY + outY * reach;

  const length = reach - settings.tipGap;
  // It grows in with its length, so it never appears at full strength.
  const strength = inside && length > 0.5
    ? traceAmount * settings.traceStrength * fade * smoothstep(0.5, 12, length) *
      (1 - smoothstep(0, settings.reach, reach))
    : 0;
  // A short trace stays a tongue pointing at the pointer rather than swelling
  // into a half-disc that curves around it.
  const mouth = Math.min(settings.traceWidth, Math.max(length, 0) * 0.6);
  const tip = mouth * 0.35;
  return {
    frame: [x, y, -outX, -outY],
    shape: [mouth, tip, Math.max(length - tip, mouth - tip + 0.01), strength],
    swellPoints,
    swells,
  };
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

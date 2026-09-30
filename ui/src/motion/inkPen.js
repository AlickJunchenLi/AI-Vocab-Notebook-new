/*
 * The pen that writes in an InkField. While characters are being written, a
 * small pen tip travels over each one along the path a hand would take for
 * it (the same strokes as inkStrokes.js): up and down across a letter, down a
 * digit or a bracket, round a loop, a tap for a full stop, the strokes of a
 * Chinese character. Between characters it glides on; when writing stops it
 * lifts off the page and fades.
 *
 * The pen is two nested elements: the outer one moves across (steadily, like
 * a hand along a line) and carries the fade, the inner one moves up and down
 * (easing at each turn, like a nib changing direction). Both are transform and
 * opacity animations, so the pen stays smooth even while the page is busy.
 */

// Each stroke's path, in the glyph's own box: x across, y down (0 is the top
// of the line, about 0.75 the baseline).
function loop() {
  const points = [];
  for (let step = 0; step <= 8; step += 1) {
    // Anticlockwise from the top right, once round.
    const angle = Math.PI / 4 + (step / 8) * Math.PI * 2;
    points.push([0.5 + 0.42 * Math.cos(angle), 0.6 - 0.2 * Math.sin(angle)]);
  }
  return points;
}

const SWEEP = [[0, 0.64], [0.16, 0.44], [0.32, 0.74], [0.5, 0.45], [0.68, 0.74], [0.84, 0.47], [1, 0.62]];

const PATHS = {
  sweep: SWEEP,
  back: SWEEP.map(([x, y]) => [1 - x, y]),
  down: [[0.46, 0.2], [0.53, 0.48], [0.48, 0.78]],
  loop: loop(),
  dot: [[0.5, 0.64], [0.5, 0.76], [0.54, 0.7]],
  brush: [[0.08, 0.32], [0.92, 0.28], [0.52, 0.16], [0.5, 0.86], [0.16, 0.6], [0.88, 0.74]],
  stamp: [[0.5, 0.42], [0.5, 0.58], [0.5, 0.5]],
};

// How the pen comes down, holds at the end of the last stroke and lifts off.
const LAND = 45;
const HOLD = 120;
const LIFT = 260;
// The nib changes direction smoothly at each point of a path.
const TURN = "cubic-bezier(0.45, 0, 0.55, 1)";

/*
 * Starts the pen over `glyphs` (the characters just written, each with its
 * key, stroke, delay and duration). `layer` holds their spans; `pen` and
 * `nib` are the pen's two elements. Returns the two animations, or null.
 */
export function writeWithPen({ layer, pen, nib, glyphs, previous }) {
  const spans = glyphs.map((glyph) => layer.querySelector(`[data-ink-key="${glyph.key}"]`));

  if (!spans[0]) {
    return null;
  }

  // A glyph span is padded so its paint can reach the loops of the hand;
  // the glyph itself sits inside the padding.
  const style = window.getComputedStyle(spans[0]);
  const padX = parseFloat(style.paddingLeft) || 0;
  const padY = parseFloat(style.paddingTop) || 0;
  const em = parseFloat(style.fontSize) || 16;
  const points = [];

  glyphs.forEach((glyph, index) => {
    const span = spans[index];

    if (!span) {
      return;
    }

    const box = {
      x: span.offsetLeft + padX,
      y: span.offsetTop + padY,
      width: Math.max(1, span.offsetWidth - padX * 2),
      height: Math.max(1, span.offsetHeight - padY * 2),
    };
    // Characters written together share the pen: it moves on as the next
    // one starts, and stays for the whole stroke on the last.
    const next = glyphs[index + 1];
    const time = next ? Math.max(1, next.delay - glyph.delay) : glyph.duration;
    const path = PATHS[glyph.stroke] ?? PATHS.sweep;

    path.forEach(([x, y], step) => {
      points.push({
        x: box.x + x * box.width,
        y: box.y + y * box.height,
        at: glyph.delay + (time * step) / (path.length - 1),
      });
    });
  });

  if (points.length === 0) {
    return null;
  }

  // Pick the pen up from wherever it is now, if it's still on the page.
  let from = null;

  if (previous) {
    const across = new DOMMatrixReadOnly(window.getComputedStyle(pen).transform);
    const down = new DOMMatrixReadOnly(window.getComputedStyle(nib).transform);
    const opacity = parseFloat(window.getComputedStyle(pen).opacity) || 0;
    from = opacity > 0.05 ? { x: across.m41, y: down.m42, opacity } : null;
    previous.across.cancel();
    previous.down.cancel();
  }

  const first = points[0];
  const last = points[points.length - 1];
  const end = last.at;
  // The path is fitted in after the pen has come down (or glided over), and
  // still ends with the last stroke.
  const scale = end > LAND ? (end - LAND) / end : 1;
  const at = (time) => LAND + time * scale;
  const duration = at(end) + HOLD + LIFT;
  const offset = (time) => Math.min(1, time / duration);
  const start = from ?? { x: first.x + 0.12 * em, y: first.y - 0.45 * em, opacity: 0 };

  const across = [
    { offset: 0, transform: `translateX(${start.x}px)`, opacity: start.opacity },
    ...points.map((point) => ({
      offset: offset(at(point.at)),
      transform: `translateX(${point.x}px)`,
      opacity: 1,
    })),
    { offset: offset(at(end) + HOLD), transform: `translateX(${last.x}px)`, opacity: 1 },
    { offset: 1, transform: `translateX(${last.x + 0.18 * em}px)`, opacity: 0 },
  ];
  const down = [
    { offset: 0, transform: `translateY(${start.y}px)`, easing: TURN },
    ...points.map((point) => ({
      offset: offset(at(point.at)),
      transform: `translateY(${point.y}px)`,
      easing: TURN,
    })),
    { offset: offset(at(end) + HOLD), transform: `translateY(${last.y}px)`, easing: "ease-in" },
    { offset: 1, transform: `translateY(${last.y - 0.55 * em}px)` },
  ];

  return {
    across: pen.animate(across, { duration, fill: "forwards" }),
    down: nib.animate(down, { duration, fill: "forwards" }),
  };
}

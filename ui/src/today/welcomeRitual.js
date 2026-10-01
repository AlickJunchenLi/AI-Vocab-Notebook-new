import { LAYOUT_EASE } from "../motion/useSmoothLayout.js";

/*
 * The welcome: the notebook opens onto a bare page, and in the middle of it
 * the day's header is set out as a small composition, which then moves up
 * into the page and becomes its header.
 *
 *   1. The greeting drifts in along an arc above the page, tilted and faint
 *      at first, its shadow on the paper closing in as it lands.
 *   2. The summary beneath it rises out of its line, letter by letter.
 *   3. A strip of paper is laid under them, and this week's check-in is
 *      printed onto it.
 *   4. The finished composition rests for a moment.
 *   5. Its three parts travel to their places: the greeting and summary up
 *      into the header, growing smaller and moving to the left, and the
 *      check-in to its place below them. The rest of the notebook (the page
 *      names and actions, the tally, the page itself) comes in as they near
 *      it, and the paper under it all never moves.
 *
 * The full welcome is for the first opening of the day; later openings get
 * the brief one, the same scene played quicker.
 *
 * Everything is already in its final place in the layout; the welcome only
 * moves, scales, fades and clips it there, so nothing on the page shifts
 * when it ends and there is only ever one of each thing on screen. Times
 * are in milliseconds from the start; `tilt` is how far the greeting starts
 * turned clockwise.
 */
const TIMELINES = {
  full: {
    tilt: 10,
    greeting: { at: 100, duration: 1150 },
    letters: { at: 720, spread: 440, duration: 560 },
    paper: { at: 1220, duration: 640 },
    info: { at: 1500, duration: 420 },
    // The composition is complete at about 1.9s and rests until the move.
    settle: { at: 2380, duration: 900 },
    rest: { at: 2700, duration: 620, stagger: 50 },
    chrome: { at: 2700, duration: 600 },
    tally: { at: 2950, duration: 400 },
  },
  brief: {
    tilt: 6,
    greeting: { at: 40, duration: 760 },
    letters: { at: 300, spread: 260, duration: 440 },
    paper: { at: 540, duration: 480 },
    info: { at: 740, duration: 320 },
    settle: { at: 1260, duration: 760 },
    rest: { at: 1500, duration: 520, stagger: 40 },
    chrome: { at: 1500, duration: 500 },
    tally: { at: 1680, duration: 340 },
  },
};
// Skipping plays what is left this many times faster: the final layout in a
// fraction of a second, still arriving softly rather than snapping.
const SKIP_RATE = 10;
const ARC_STEPS = 48;

// A cubic-bezier easing as a function, for curves sampled in script.
function cubicBezier(x1, y1, x2, y2) {
  const along = (a, b, s) => 3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s;

  return (t) => {
    let low = 0;
    let high = 1;

    for (let step = 0; step < 32; step += 1) {
      const middle = (low + high) / 2;

      if (along(x1, x2, middle) < t) {
        low = middle;
      } else {
        high = middle;
      }
    }

    return along(y1, y2, (low + high) / 2);
  };
}

// Quick to set off, then a long, weightless slowing into place.
const glide = cubicBezier(0.16, 1, 0.3, 1);
const easeOut = (power) => (t) => 1 - (1 - t) ** power;
const levelling = easeOut(3);
const brightening = easeOut(2);

/*
 * The greeting's path, from above and to the right of where it rests: it
 * sweeps down and to the left, steeply at first, then flattens and comes in
 * level, so its last approach is horizontal. Positions are measured along
 * the curve's length, so the path's shape and the speed along it are set
 * independently.
 */
function arc(dx, dy) {
  const points = [
    { x: dx, y: -dy },
    { x: dx * 0.8, y: -dy * 0.2 },
    { x: dx * 0.36, y: 0 },
    { x: 0, y: 0 },
  ];
  const at = (s) => {
    const [a, b, c, d] = points;
    const u = 1 - s;
    return {
      x: u * u * u * a.x + 3 * u * u * s * b.x + 3 * u * s * s * c.x + s * s * s * d.x,
      y: u * u * u * a.y + 3 * u * u * s * b.y + 3 * u * s * s * c.y + s * s * s * d.y,
    };
  };

  const samples = [{ s: 0, length: 0, ...at(0) }];

  for (let step = 1; step <= 200; step += 1) {
    const point = at(step / 200);
    const last = samples[step - 1];
    samples.push({ s: step / 200, length: last.length + Math.hypot(point.x - last.x, point.y - last.y), ...point });
  }

  const total = samples.at(-1).length;

  // The point a given fraction of the way along the curve.
  return (fraction) => {
    const target = fraction * total;
    let index = samples.findIndex((sample) => sample.length >= target);

    if (index <= 0) {
      return index === 0 ? samples[0] : samples.at(-1);
    }

    const before = samples[index - 1];
    const after = samples[index];
    const share = (target - before.length) / (after.length - before.length || 1);
    return { x: before.x + (after.x - before.x) * share, y: before.y + (after.y - before.y) * share };
  };
}

function greetingFrames(dx, dy, startTilt) {
  const along = arc(dx, dy);

  return Array.from({ length: ARC_STEPS + 1 }, (_, step) => {
    const t = step / ARC_STEPS;
    const travelled = glide(t);
    const { x, y } = along(travelled);
    // Level a little before it lands, and fully visible well before that.
    const tilt = startTilt * (1 - levelling(Math.min(1, t / 0.82)));
    // Held above the paper, it casts a soft shadow that draws in under it
    // and fades as it comes down onto the page.
    const height = 1 - travelled;
    return {
      offset: t,
      opacity: brightening(Math.min(1, t / 0.5)),
      transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${tilt.toFixed(3)}deg)`,
      textShadow: `0 ${(14 * height).toFixed(2)}px ${(18 * height + 0.01).toFixed(2)}px color-mix(in srgb, var(--shade) ${(20 * height).toFixed(2)}%, transparent)`,
    };
  });
}

const clamp = (value, low, high) => Math.min(Math.max(value, low), high);

/*
 * Where the welcome sets things out, worked out from where they finally
 * rest. The greeting, the summary and the check-in are stacked in the middle
 * of the window, each centred on its own: the greeting larger, the summary a
 * touch larger, the check-in as it is. Each part's move is a translation and
 * a scale from the top left corner of its own box (the CSS transform-origin
 * of .today-greeting and .today-summary), which it unwinds to nothing in its
 * place in the header. The arc starts no further right than the window has
 * room for.
 */
export function measureWelcome({ greetingStage, greeting, summaryStage, summaryText, checkin }) {
  const view = { width: window.innerWidth, height: window.innerHeight };
  const compact = view.width < 560;
  const line = greetingStage.getBoundingClientRect();
  const text = greeting.getBoundingClientRect();
  const block = summaryStage.getBoundingClientRect();
  const words = summaryText.getBoundingClientRect();
  const strip = checkin.getBoundingClientRect();
  const room = view.width - (compact ? 32 : 96);
  const greetingScale = clamp(room / Math.max(text.width, 1), 1, compact ? 1.12 : 1.32);
  const summaryScale = clamp(room / Math.max(words.width, 1), 1, compact ? 1 : 1.06);
  const [nearGap, farGap] = compact ? [10, 26] : [14, 36];
  const greetingHeight = line.height * greetingScale;
  const summaryHeight = block.height * summaryScale;
  const height = greetingHeight + nearGap + summaryHeight + farGap + strip.height;
  // A little above the true middle, where a composition looks centred.
  const top = Math.max(16, (view.height - height) / 2 - view.height * 0.03);
  const middle = view.width / 2;

  // How far to move a box so the text it holds, scaled, is centred at `top`.
  const centre = (box, inner, scale, at) => ({
    x: middle - (inner.width * scale) / 2 - box.left - (inner.left - box.left) * scale,
    y: at - box.top,
    scale,
  });

  const summaryTop = top + greetingHeight + nearGap;
  const checkinTop = summaryTop + summaryHeight + farGap;
  const spare = (view.width - (middle + (text.width * greetingScale) / 2)) / greetingScale - 12;

  return {
    greeting: centre(line, text, greetingScale, top),
    summary: centre(block, words, summaryScale, summaryTop),
    checkin: centre(strip, strip, 1, checkinTop),
    arcX: clamp(spare, 24, compact ? 48 : 104),
    arcY: compact ? 36 : 60,
    paperWidth: checkin.offsetWidth,
  };
}

/*
 * Plays the welcome ("full" or "brief"). `greetingStage` and `summaryStage`
 * carry the greeting's line and the summary to and from the middle, while
 * `greeting` itself takes the arc; `rest` is the rest of the page, `chrome`
 * the notebook around it (the header's names and actions, the footer), and
 * `tally` the header's counts. Returns `finished` (settles when it has
 * played), `skip` (plays the rest quickly) and `cancel` (removes it at once).
 */
export function playWelcome(parts, layout, mode = "full") {
  const { greetingStage, greeting, summaryStage, letters, checkin, paper, info, rest, chrome, tally } = parts;
  const TIMELINE = TIMELINES[mode] ?? TIMELINES.full;
  const animations = [];
  const run = (element, keyframes, options) => {
    if (element) {
      animations.push(element.animate(keyframes, { fill: "both", ...options }));
    }
  };

  run(greeting, greetingFrames(layout.arcX, layout.arcY, TIMELINE.tilt), {
    delay: TIMELINE.greeting.at,
    duration: TIMELINE.greeting.duration,
    easing: "linear",
  });

  // A short wave from left to right, however long the sentence.
  const step = letters.length > 1 ? Math.min(22, TIMELINE.letters.spread / (letters.length - 1)) : 0;
  letters.forEach((letter, index) => {
    run(letter, [{ transform: "translateY(112%)" }, { transform: "translateY(0)" }], {
      delay: TIMELINE.letters.at + index * step,
      duration: TIMELINE.letters.duration,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    });
  });

  // The paper is uncovered from its left edge, never stretched; the room
  // around it lets its shadow show once it is down.
  run(paper, [
    { clipPath: `inset(-12px ${layout.paperWidth}px -18px 0px)` },
    { clipPath: "inset(-12px -12px -18px -12px)" },
  ], {
    delay: TIMELINE.paper.at,
    duration: TIMELINE.paper.duration,
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  });

  run(info, [{ opacity: 0, transform: "translateY(3px)" }, { opacity: 1, transform: "translateY(0)" }], {
    delay: TIMELINE.info.at,
    duration: TIMELINE.info.duration,
    easing: "cubic-bezier(0.25, 0.7, 0.3, 1)",
  });

  // From the middle to the header: one gentle ease-out shared by all three,
  // so they move as one composition coming apart into the page.
  const settle = { delay: TIMELINE.settle.at, duration: TIMELINE.settle.duration, easing: LAYOUT_EASE };
  const from = ({ x, y, scale }) => `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${scale.toFixed(4)})`;
  run(greetingStage, [{ transform: from(layout.greeting) }, { transform: "translate(0px, 0px) scale(1)" }], settle);
  run(summaryStage, [{ transform: from(layout.summary) }, { transform: "translate(0px, 0px) scale(1)" }], settle);
  run(checkin, [{ transform: from(layout.checkin) }, { transform: "translate(0px, 0px) scale(1)" }], settle);

  // The notebook comes in around them as they near their places.
  rest.forEach((element, index) => {
    run(element, [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "translateY(0)" }], {
      delay: TIMELINE.rest.at + index * TIMELINE.rest.stagger,
      duration: TIMELINE.rest.duration,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    });
  });

  chrome.forEach((element) => {
    run(element, [{ opacity: 0 }, { opacity: 1 }], {
      delay: TIMELINE.chrome.at,
      duration: TIMELINE.chrome.duration,
      easing: "cubic-bezier(0.25, 0.7, 0.3, 1)",
    });
  });

  run(tally, [{ opacity: 0 }, { opacity: 1 }], {
    delay: TIMELINE.tally.at,
    duration: TIMELINE.tally.duration,
    easing: "cubic-bezier(0.25, 0.7, 0.3, 1)",
  });

  return {
    finished: Promise.all(animations.map((animation) => animation.finished)),
    skip() {
      for (const animation of animations) {
        if (animation.playState !== "finished") {
          animation.updatePlaybackRate(SKIP_RATE);
        }
      }
    },
    cancel() {
      for (const animation of animations) {
        animation.cancel();
      }
    },
  };
}

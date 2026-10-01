import { LAYOUT_EASE } from "../motion/useSmoothLayout.js";

/*
 * The welcome: the notebook opens onto a nearly empty page and the day's
 * header is written onto it in four overlapping beats.
 *
 *   1. The greeting drifts in along an arc above the page, tilted and faint
 *      at first, its shadow on the paper closing in as it lands.
 *   2. The summary beneath it rises out of its line, letter by letter.
 *   3. A strip of paper is laid under them, and this week's check-in is
 *      printed onto it.
 *   4. All three glide up into the page's header, and the rest of the page
 *      comes in beneath them once they have mostly cleared it; the tally,
 *      which sits between them on a narrow screen, comes in last.
 *
 * That is the full welcome, for the first opening of the day. Every later
 * opening gets the brief one: the same beats, quicker and overlapping more,
 * written straight into the header without the larger setting first.
 *
 * Everything is already in its final place in the layout; the welcome only
 * moves, fades and clips it there, so nothing on the page shifts when it
 * ends. Times are in milliseconds from the start; `tilt` is how far the
 * greeting starts turned clockwise.
 */
const TIMELINES = {
  full: {
    tilt: 10,
    greeting: { at: 80, duration: 1150 },
    letters: { at: 740, spread: 440, duration: 560 },
    paper: { at: 1300, duration: 660 },
    info: { at: 1580, duration: 440 },
    settle: { at: 1980, duration: 800 },
    rest: { at: 2280, duration: 620, stagger: 50 },
    tally: { at: 2500, duration: 400 },
  },
  brief: {
    tilt: 6,
    greeting: { at: 40, duration: 760 },
    letters: { at: 300, spread: 260, duration: 440 },
    paper: { at: 520, duration: 480 },
    info: { at: 720, duration: 320 },
    settle: null,
    rest: { at: 600, duration: 520, stagger: 40 },
    tally: { at: 760, duration: 340 },
  },
};
// Skipping plays what is left this many times faster, so it still ends softly.
const SKIP_RATE = 6;
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

/*
 * Where the welcome sets things out, worked out from where they finally
 * rest: for the full welcome, the greeting and summary a little larger, and
 * the group of them with the check-in placed a little above the middle of
 * the window, left edges where they will stay; the brief one leaves them in
 * place. The arc starts no further right than the page has room for.
 */
export function measureWelcome({ page, title, greeting, summary, checkin }, mode = "full") {
  const view = { width: window.innerWidth, height: window.innerHeight };
  const compact = view.width < 560;
  const menu = document.querySelector(".top-menu")?.getBoundingClientRect().bottom ?? 0;
  const pageBox = page.getBoundingClientRect();
  const titleBox = title.getBoundingClientRect();
  const checkinBox = checkin.getBoundingClientRect();
  const greetingWidth = greeting.getBoundingClientRect().width;
  const textWidth = Math.max(greetingWidth, summary.getBoundingClientRect().width, 1);
  const scale = Math.min(Math.max((pageBox.right - titleBox.left - 8) / textWidth, 1), compact ? 1.1 : 1.28);
  const gap = compact ? 26 : 40;
  const groupHeight = titleBox.height * scale + gap + checkinBox.height;
  const top = menu + 16;
  const room = view.height - top - 16;
  const groupTop = top + Math.max(0, (room - groupHeight) * 0.42);
  const spare = (pageBox.right - (titleBox.left + greetingWidth * scale)) / scale - 12;

  if (mode === "brief") {
    return {
      scale: 1,
      titleShift: 0,
      checkinShift: 0,
      arcX: Math.min(Math.max(spare, 16), compact ? 32 : 48),
      arcY: compact ? 18 : 26,
      paperWidth: checkin.offsetWidth,
    };
  }

  return {
    scale,
    titleShift: Math.max(0, groupTop - titleBox.top),
    checkinShift: Math.max(0, groupTop + titleBox.height * scale + gap - checkinBox.top),
    arcX: Math.min(Math.max(spare, 24), compact ? 56 : 104),
    arcY: compact ? 40 : 64,
    paperWidth: checkin.offsetWidth,
  };
}

/*
 * Plays the welcome ("full" or "brief") on the header's parts; `rest` is the
 * rest of the page, brought in at the end, and `tally` the header's counts.
 * Returns `finished` (settles when it has played), `skip` (plays the rest
 * quickly) and `cancel` (removes it at once).
 */
export function playWelcome({ title, greeting, letters, checkin, paper, info, rest, tally }, layout, mode = "full") {
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

  if (TIMELINE.settle) {
    const settle = { delay: TIMELINE.settle.at, duration: TIMELINE.settle.duration, easing: LAYOUT_EASE };
    run(title, [{ transform: `translateY(${layout.titleShift}px) scale(${layout.scale})` }, { transform: "translateY(0) scale(1)" }], settle);
    run(checkin, [{ transform: `translateY(${layout.checkinShift}px)` }, { transform: "translateY(0)" }], settle);
  }

  rest.forEach((element, index) => {
    run(element, [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "translateY(0)" }], {
      delay: TIMELINE.rest.at + index * TIMELINE.rest.stagger,
      duration: TIMELINE.rest.duration,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
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

import { revealContent } from "../motion/contentReveal.js";

/*
 * The welcome: the notebook opens onto a bare page, and in the middle of it
 * the day's header is set out large, as a small composition, which then
 * moves up into the page and becomes its header.
 *
 *   1. The greeting sets off from the top left of the page, where the
 *      writing starts, tilted, and drifts along an arc above the page to its
 *      place in the middle, its shadow on the paper closing in as it lands;
 *      its letters appear one by one, left to right, as it travels.
 *   2. The summary beneath it rises out of its line, letter by letter.
 *   3. A strip of paper is laid under them, and this week's check-in is
 *      printed onto it.
 *   4. The finished composition rests, long enough to be read.
 *   5. Its three parts travel to their places one after another, the
 *      greeting first, then the summary, then the check-in, each setting off
 *      quickly and slowing gently as it arrives, and shrinking to its size on
 *      the page as it goes: the greeting and summary up into the header and
 *      over to the left, the check-in to its place below them. The header's
 *      names and actions, and the tally, come in as they near it.
 *   6. A moment after the last of them has settled, the rest of the page
 *      fades in, its cards and slips still blank; then what is on them is
 *      uncovered, group by group from the top of the page down, each
 *      wiping in from its top edge.
 *
 * The paper under it all never moves. The full welcome is for the first
 * opening of the day; later openings get the brief one, the same scene
 * played quicker.
 *
 * Everything is already in its final place in the layout; the welcome only
 * moves, scales, fades and clips it there, so nothing on the page shifts
 * when it ends and there is only ever one of each thing on screen. Times
 * are in milliseconds from the start; `tilt` is how far the greeting starts
 * turned clockwise; in `settle`, `stagger` is the gap between the parts
 * setting off.
 */
const TIMELINES = {
  full: {
    tilt: 10,
    greeting: { at: 100, duration: 1700 },
    greetingLetters: { at: 100, spread: 900, duration: 650 },
    letters: { at: 1400, spread: 440, duration: 560 },
    paper: { at: 1950, duration: 700 },
    info: { at: 2250, duration: 440 },
    // Complete at about 2.7s, and read until the move begins.
    settle: { at: 4320, duration: 1400, stagger: 180 },
    chrome: { at: 5340, duration: 700 },
    tally: { at: 5590, duration: 450 },
    container: { duration: 700 },
    groups: { spread: 700, duration: 1000 },
  },
  brief: {
    tilt: 8,
    greeting: { at: 40, duration: 1000 },
    greetingLetters: { at: 40, spread: 500, duration: 450 },
    letters: { at: 760, spread: 260, duration: 440 },
    paper: { at: 980, duration: 500 },
    info: { at: 1180, duration: 320 },
    settle: { at: 1700, duration: 800, stagger: 110 },
    chrome: { at: 2200, duration: 450 },
    tally: { at: 2350, duration: 350 },
    container: { duration: 700 },
    groups: { spread: 450, duration: 1000 },
  },
};
// The page waits this long after the check-in, the last part to arrive, has
// finished its move (it is still well before then) before it appears, and
// its contents start once it is mostly there.
const CONTENT_WAIT = 140;
// Quick to set off, slowing gently into place: the parts' move to the page.
const ARRIVE = "cubic-bezier(0.22, 1, 0.36, 1)";
const CONTENT_OVERLAP = 0.6;
// Skipping plays what is left this many times faster: the final layout in
// about half a second, still arriving softly rather than snapping.
const SKIP_RATE = 16;
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

/*
 * The greeting's path, from where it sets off (`dx` across, `dy` up from
 * where it rests): it sweeps down and across, steeply at first, then
 * flattens and comes in level, so its last approach is horizontal. Positions are measured along
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

// The greeting's whole line on its arc; its letters fade in on their own.
function greetingFrames(dx, dy, startTilt) {
  const along = arc(dx, dy);

  return Array.from({ length: ARC_STEPS + 1 }, (_, step) => {
    const t = step / ARC_STEPS;
    const travelled = glide(t);
    const { x, y } = along(travelled);
    // Level a little before it lands.
    const tilt = startTilt * (1 - levelling(Math.min(1, t / 0.82)));
    // Held above the paper, it casts a soft shadow that draws in under it
    // and fades as it comes down onto the page.
    const height = 1 - travelled;
    return {
      offset: t,
      transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${tilt.toFixed(3)}deg)`,
      textShadow: `0 ${(14 * height).toFixed(2)}px ${(18 * height + 0.01).toFixed(2)}px color-mix(in srgb, var(--shade) ${(20 * height).toFixed(2)}%, transparent)`,
    };
  });
}

const clamp = (value, low, high) => Math.min(Math.max(value, low), high);

/*
 * Where the welcome sets things out, worked out from where they finally
 * rest. The greeting, the summary and the check-in are stacked in the middle
 * of the window, each centred on its own and set larger than on the page:
 * the greeting much larger, the summary and the check-in by a third and a
 * fifth, as far as the window's width allows (and a short window, its
 * height). Each part's move is a translation and a scale from the top left
 * corner of its own box (the CSS transform-origin of .today-greeting,
 * .today-summary and .today-checkin), which it unwinds to nothing in its
 * place on the page. The greeting's arc sets off from the top left of the
 * page: where its letters finally sit, at the head of the writing column.
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
  const largest = {
    greeting: clamp(room / Math.max(text.width, 1), 1, compact ? 1.25 : 1.85),
    summary: clamp(room / Math.max(words.width, 1), 1, compact ? 1.08 : 1.32),
    checkin: clamp(room / Math.max(strip.width, 1), 1, compact ? 1 : 1.2),
  };
  const [nearGap, farGap] = compact ? [12, 30] : [20, 48];
  const heightAt = (scale) => line.height * scale.greeting + nearGap + block.height * scale.summary +
    farGap + strip.height * scale.checkin;
  // Shrink towards the page sizes only as far as a short window needs.
  const plain = { greeting: 1, summary: 1, checkin: 1 };
  const fit = clamp((view.height - 32 - heightAt(plain)) / Math.max(heightAt(largest) - heightAt(plain), 1), 0, 1);
  const scale = Object.fromEntries(Object.entries(largest).map(([part, value]) => [part, 1 + (value - 1) * fit]));
  const height = heightAt(scale);
  // A little above the true middle, where a composition looks centred.
  const top = Math.max(16, (view.height - height) / 2 - view.height * 0.03);
  const middle = view.width / 2;

  // How far to move a box so the text it holds, scaled, is centred at `at`.
  const centre = (box, inner, factor, at) => ({
    x: middle - (inner.width * factor) / 2 - box.left - (inner.left - box.left) * factor,
    y: at - box.top,
    scale: factor,
  });

  const summaryTop = top + line.height * scale.greeting + nearGap;
  const checkinTop = summaryTop + block.height * scale.summary + farGap;
  // From the top left, in the greeting's own (scaled) units; always a little
  // way across, so the arc keeps its curve when the greeting fills the width.
  const restLeft = middle - (text.width * scale.greeting) / 2;
  const restTop = top + (text.top - line.top) * scale.greeting;
  const across = (text.left - restLeft) / scale.greeting;

  return {
    greeting: centre(line, text, scale.greeting, top),
    summary: centre(block, words, scale.summary, summaryTop),
    checkin: centre(strip, strip, scale.checkin, checkinTop),
    arcX: Math.abs(across) < 16 ? -16 : across,
    arcY: Math.max(0, (restTop - text.top) / scale.greeting),
    paperWidth: checkin.offsetWidth,
  };
}

/*
 * Plays the welcome ("full" or "brief"). `greetingStage`, `summaryStage` and
 * `checkin` are carried from the middle to their places, while `greeting`
 * takes the arc in and its `greetingLetters` appear one by one; `chrome` is the notebook around the page (the
 * header's names and actions) and `tally` the header's counts; `container`
 * is the rest of the page and `groups` what is on it, from the top down.
 * Returns `finished` (settles when it has played), `skip` (plays the rest
 * quickly) and `cancel` (removes it at once).
 */
export function playWelcome(parts, layout, mode = "full") {
  const { greetingStage, greeting, greetingLetters, summaryStage, letters, checkin, paper, info, chrome, tally, container, groups } = parts;
  const TIMELINE = TIMELINES[mode] ?? TIMELINES.full;
  const animations = [];
  const run = (element, keyframes, options) => {
    if (!element) return null;
    const animation = element.animate(keyframes, { fill: "both", ...options });
    animations.push(animation);
    return animation;
  };

  run(greeting, greetingFrames(layout.arcX, layout.arcY, TIMELINE.tilt), {
    delay: TIMELINE.greeting.at,
    duration: TIMELINE.greeting.duration,
    easing: "linear",
  });

  // As it travels, its letters appear one after another, left to right,
  // each fading in as it rises a little into its place in the line.
  const letterGap = greetingLetters.length > 1
    ? TIMELINE.greetingLetters.spread / (greetingLetters.length - 1)
    : 0;
  greetingLetters.forEach((letter, index) => {
    run(letter, [{ opacity: 0, transform: "translateY(0.3em)" }, { opacity: 1, transform: "translateY(0)" }], {
      delay: TIMELINE.greetingLetters.at + index * letterGap,
      duration: TIMELINE.greetingLetters.duration,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    });
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

  // From the middle to the page, line by line: the greeting sets off first,
  // then the summary, then the check-in, each growing smaller as it goes.
  const { settle } = TIMELINE;
  const from = ({ x, y, scale }) => `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${scale.toFixed(4)})`;
  const home = "translate(0px, 0px) scale(1)";
  [
    [greetingStage, layout.greeting],
    [summaryStage, layout.summary],
    [checkin, layout.checkin],
  ].forEach(([element, start], order) => {
    run(element, [{ transform: from(start) }, { transform: home }], {
      delay: settle.at + order * settle.stagger,
      duration: settle.duration,
      easing: ARRIVE,
    });
  });
  const settled = settle.at + 2 * settle.stagger + settle.duration;

  const fadeIn = (element, timing) => run(element, [{ opacity: 0 }, { opacity: 1 }], {
    ...timing,
    easing: "cubic-bezier(0.25, 0.7, 0.3, 1)",
  });
  chrome.forEach((element) => fadeIn(element, { delay: TIMELINE.chrome.at, duration: TIMELINE.chrome.duration }));
  fadeIn(tally, { delay: TIMELINE.tally.at, duration: TIMELINE.tally.duration });

  // The rest of the page, blank, half a second after everything has landed.
  // Once it is in, its opacity is written to the element and the animation
  // let go, so it doesn't hold the page as a separate layer (glass on it
  // would blur only what is inside it) while its contents come in.
  const containerAt = settled + CONTENT_WAIT;
  const containerFade = fadeIn(container, { delay: containerAt, duration: TIMELINE.container.duration });
  containerFade?.finished.then(() => {
    containerFade.commitStyles();
    containerFade.cancel();
  }, () => {});

  // Then what is on it, group by group from the top down (contentReveal.js).
  animations.push(...revealContent(groups, {
    at: containerAt + TIMELINE.container.duration * CONTENT_OVERLAP,
    spread: TIMELINE.groups.spread,
    gap: 70,
    duration: TIMELINE.groups.duration,
  }));

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
      container?.style.removeProperty("opacity");
    },
  };
}

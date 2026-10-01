/*
 * Bringing a page's content in after its surfaces. A page arrives in two
 * stages: first its surfaces (the glass cards and panels, the slips of
 * paper) appear blank, then what is written on them, and on the paper
 * between them, is uncovered group by group in reading order, each group
 * fading in as it is revealed from its left edge. Nothing is moved or
 * scaled, so text and controls are never distorted. Charts come in their
 * own way, as they would be drawn: a column chart's bars rise one after
 * another, and a stacked bar fills from its left end while its percentages
 * count up. Used when the notebook turns to a page (PageTurn.jsx) and at the
 * end of the day's welcome (today/welcomeRitual.js).
 */

// Surfaces, and where the content on each of them sits (null: directly in it).
const SURFACES = [
  { surface: ".liquid-glass-surface", content: ":scope > .liquid-glass-content" },
  { surface: ".tour-invite-slip", content: null },
  { surface: ".today-checkin", content: ":scope > .checkin-info" },
];
const SURFACE = SURFACES.map((entry) => entry.surface).join(", ");

// Quick to start and slow to finish, for everything uncovered here.
const EASE = "cubic-bezier(0.25, 0.8, 0.3, 1)";
// Within a chart, its bars start at most this far apart, and all of them
// within `CHART_SPREAD`.
const BAR_GAP = 70;
const CHART_SPREAD = 420;

/*
 * The days' bars of a column chart (Progress, Reviews), rising one after
 * another from left to right. Each bar grows up from the baseline, its
 * count riding on its top, and the day's name fades in beneath it.
 */
function riseBars(plot, delay, duration) {
  const points = [...plot.querySelectorAll(":scope > .progress-rhythm-point")];
  const gap = points.length > 1 ? Math.min(BAR_GAP, CHART_SPREAD / (points.length - 1)) : 0;

  return points.flatMap((point, index) => {
    const timing = { delay: delay + index * gap, duration, easing: EASE, fill: "both" };
    const height = parseFloat(window.getComputedStyle(point, "::before").height) || 0;
    const value = point.querySelector(".progress-rhythm-value");
    const label = point.querySelector(".progress-rhythm-label");

    return [
      point.animate([{ height: "0px" }, { height: `${height}px` }], { ...timing, pseudoElement: "::before" }),
      value?.animate([
        { offset: 0, opacity: 0, transform: `translateY(${height}px)` },
        { offset: 0.35, opacity: 1 },
        { offset: 1, opacity: 1, transform: "translateY(0)" },
      ], timing),
      label?.animate([{ opacity: 0 }, { opacity: 1 }], { ...timing, duration: duration * 0.5 }),
    ].filter(Boolean);
  });
}

// The numbers being counted up, with their real figures, so a count that
// takes over from one just stopped (a reveal started again at once) still
// knows what it is counting to.
const counts = new WeakMap();

/*
 * Counts a percentage up from nothing as `animation` plays, in step with its
 * easing, and puts the real figure back the moment it finishes or is
 * cancelled. The number is written into the text node already there, so the
 * page's own rendering keeps hold of it.
 */
function countUp(element, animation) {
  const node = [...element.childNodes].find((child) => child.nodeType === Node.TEXT_NODE);

  if (!node) {
    return;
  }

  const final = counts.get(node)?.final ?? node.data;
  const figure = parseInt(final, 10);

  if (!Number.isFinite(figure)) {
    return;
  }

  const count = { final };
  let frame = 0;
  const owns = () => counts.get(node) === count;
  const stop = () => {
    window.cancelAnimationFrame(frame);
    if (owns()) {
      node.data = final;
      counts.delete(node);
    }
  };
  const tick = () => {
    if (!owns()) return;
    const progress = animation.effect?.getComputedTiming().progress ?? 0;
    node.data = `${Math.round(figure * progress)}%`;
    frame = window.requestAnimationFrame(tick);
  };

  counts.set(node, count);
  animation.finished.then(stop, stop);
  tick();
}

/*
 * A stacked bar (Progress, Mastery by language) filling from its left end,
 * its rounded leading edge kept as it goes, while the percentages on it
 * count up from 0%.
 */
function fillBar(bar, delay, duration) {
  const fill = bar.animate([
    { clipPath: `inset(0 ${bar.offsetWidth}px 0 0 round 6px)` },
    { clipPath: "inset(0 0 0 0 round 6px)" },
  ], { delay, duration, easing: EASE, fill: "both" });

  for (const segment of bar.querySelectorAll(".progress-mastery-segment")) {
    countUp(segment, fill);
  }

  return [fill];
}

// Content that comes in its own way, rather than wiped in from the left.
const CHARTS = [
  { match: ".progress-rhythm-plot", reveal: riseBars },
  { match: ".progress-mastery-bar", reveal: fillBar },
];
const CHART = CHARTS.map((entry) => entry.match).join(", ");

function contentOf(surface) {
  const entry = SURFACES.find((candidate) => surface.matches(candidate.surface));
  return entry.content ? surface.querySelector(entry.content) : surface;
}

/*
 * The content groups under `root`, in reading order (the order of the page,
 * which is also the order of a stacked layout). A surface is looked into and
 * its own content taken; a block holding surfaces or charts is looked into;
 * a chart is a group of its own, as is any other block. Nothing a reader
 * can't see counts, nor anything set aside (inert, like the period a chart
 * isn't showing).
 */
export function contentGroups(root) {
  const groups = [];

  const visit = (parent) => {
    for (const child of parent.children) {
      if (child.getClientRects().length === 0 || child.matches(".sr-only, [data-layout-ghost], [inert]")) {
        continue;
      }

      if (child.matches(CHART)) {
        groups.push(child);
      } else if (child.matches(SURFACE)) {
        const content = contentOf(child);
        if (content) visit(content);
      } else if (child.querySelector(`${SURFACE}, ${CHART}`)) {
        visit(child);
      } else {
        groups.push(child);
      }
    }
  };

  if (root) visit(root);
  return groups;
}

// A group wiped in from its left edge as it fades in; the room around it
// lets focus rings and small shadows show once it is in.
function wipeIn(group, delay, duration) {
  return [group.animate([
    { offset: 0, opacity: 0, clipPath: `inset(-12px ${group.offsetWidth + 12}px -12px -12px)` },
    { offset: 0.6, opacity: 1 },
    { offset: 1, opacity: 1, clipPath: "inset(-12px -12px -12px -12px)" },
  ], { delay, duration, easing: EASE, fill: "both" })];
}

/*
 * Uncovers `groups` one after another: from `at` milliseconds, each `gap`
 * apart but all of them within `spread`, each taking `duration`. Every group
 * is hidden from the start (the animations fill backwards). Each animation
 * lets go as soon as it has finished, where it looks just as the group does
 * on its own, so no clip is left behind to cut off a menu that opens from it
 * later. Returns the animations.
 */
export function revealContent(groups, { at, spread, gap, duration }) {
  const step = groups.length > 1 ? Math.min(gap, spread / (groups.length - 1)) : 0;

  return groups.flatMap((group, index) => {
    const chart = CHARTS.find((entry) => group.matches(entry.match));
    const animations = (chart ? chart.reveal : wipeIn)(group, at + index * step, duration);

    for (const animation of animations) {
      animation.finished.then(() => animation.cancel(), () => {});
    }

    return animations;
  });
}

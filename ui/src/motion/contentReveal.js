/*
 * Bringing a page's content in after its surfaces. A page arrives in two
 * stages: first its surfaces (the glass cards and panels, the slips of
 * paper) appear blank, then what is written on them, and on the paper
 * between them, is uncovered group by group in reading order, each group
 * fading in as it is revealed from its left edge. Nothing is moved or
 * scaled, so text and controls are never distorted. Used when the notebook
 * turns to a page (PageTurn.jsx) and at the end of the day's welcome
 * (today/welcomeRitual.js).
 */

// Surfaces, and where the content on each of them sits (null: directly in it).
const SURFACES = [
  { surface: ".liquid-glass-surface", content: ":scope > .liquid-glass-content" },
  { surface: ".tour-invite-slip", content: null },
  { surface: ".today-checkin", content: ":scope > .checkin-info" },
];
const SURFACE = SURFACES.map((entry) => entry.surface).join(", ");

function contentOf(surface) {
  const entry = SURFACES.find((candidate) => surface.matches(candidate.surface));
  return entry.content ? surface.querySelector(entry.content) : surface;
}

/*
 * The content groups under `root`, in reading order (the order of the page,
 * which is also the order of a stacked layout). A surface is looked into and
 * its own content taken; a block holding surfaces is looked into; any other
 * block is a group of its own. Nothing a reader can't see counts.
 */
export function contentGroups(root) {
  const groups = [];

  const visit = (parent) => {
    for (const child of parent.children) {
      if (child.getClientRects().length === 0 || child.matches(".sr-only, [data-layout-ghost]")) {
        continue;
      }

      if (child.matches(SURFACE)) {
        const content = contentOf(child);
        if (content) visit(content);
      } else if (child.querySelector(SURFACE)) {
        visit(child);
      } else {
        groups.push(child);
      }
    }
  };

  if (root) visit(root);
  return groups;
}

/*
 * Uncovers `groups` one after another: from `at` milliseconds, each `gap`
 * apart but all of them within `spread`, each taking `duration`. Every group
 * is hidden from the start (the animations fill backwards), and the room
 * around it lets focus rings and small shadows show once it is in. Each
 * animation lets go as soon as it has finished, where it looks just as the
 * group does on its own, so no clip is left behind to cut off a menu that
 * opens from it later. Returns the animations.
 */
export function revealContent(groups, { at, spread, gap, duration }) {
  const step = groups.length > 1 ? Math.min(gap, spread / (groups.length - 1)) : 0;

  return groups.map((group, index) => {
    const animation = group.animate([
      { offset: 0, opacity: 0, clipPath: `inset(-12px ${group.offsetWidth + 12}px -12px -12px)` },
      { offset: 0.6, opacity: 1 },
      { offset: 1, opacity: 1, clipPath: "inset(-12px -12px -12px -12px)" },
    ], {
      delay: at + index * step,
      duration,
      easing: "cubic-bezier(0.25, 0.8, 0.3, 1)",
      fill: "both",
    });
    animation.finished.then(() => animation.cancel(), () => {});
    return animation;
  });
}

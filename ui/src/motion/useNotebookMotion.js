import { useIsPresent, useReducedMotion } from "motion/react";

const EASE = [0.22, 1, 0.36, 1];
// Leaving eases in and out, so a dismissed surface fades away instead of
// being cut off.
const LEAVE_EASE = [0.4, 0, 0.2, 1];
const LEAVE_DURATION = 0.18;
// A soft spring with almost no overshoot: the sheet settles rather than bounces.
const SETTLE = { type: "spring", bounce: 0.1, visualDuration: 0.38 };

/*
 * Movement is written as whole transform strings, never as separate x, y or
 * scale values: Motion hands a transform string (and opacity) to the
 * browser's compositor, which keeps it smooth even while the page is busy
 * rendering (a page turning in, a dialog's form mounting), whereas separate
 * values are worked out in script every frame and stall with it. `from` is
 * where a surface arrives from, `to` where it comes to rest (the same
 * functions, so they interpolate directly), `leave` where it goes when
 * dismissed. Once arrived, the transform is cleared (unless `keep`), so a
 * surface at rest makes no stacking context or containing block of its own.
 */
const PRESETS = {
  rise: { from: "translateY(8px)", to: "translateY(0px)", duration: 0.42 },
  step: { from: "translateX(12px)", to: "translateX(0px)", duration: 0.36 },
  // Menus unfold from their trigger (transform-origin in notebookMotion.css).
  menu: { from: "translateY(-4px) scale(0.97)", to: "translateY(0px) scale(1)", duration: 0.26 },
  "menu-above": { from: "translateY(4px) scale(0.97)", to: "translateY(0px) scale(1)", duration: 0.26 },
  // A sheet laid on the desk: it arrives a little turned and straightens as it
  // settles, then lifts straight off when dismissed.
  dialog: {
    from: "translateY(14px) scale(0.97) rotate(-0.6deg)",
    to: "translateY(0px) scale(1) rotate(0deg)",
    leave: "translateY(8px) scale(0.98) rotate(0deg)",
    duration: 0.38,
    spring: SETTLE,
  },
  scrim: { duration: 0.24 },
  // The toast is centred by its own transform, so it keeps one at rest.
  toast: {
    from: "translateX(50%) translateY(12px)",
    to: "translateX(50%) translateY(0px)",
    keep: true,
    duration: 0.36,
  },
};

function enterTransition({ duration, spring }, delay) {
  if (!spring) {
    return { duration, delay, ease: EASE };
  }

  // Opacity keeps a plain fade so the spring never pushes it past fully visible.
  return { ...spring, delay, opacity: { duration: 0.26, delay, ease: EASE } };
}

// A single vocabulary for entry, state change and dismissal. Exiting UI becomes
// inert immediately, so retained animation frames cannot receive stale actions.
export default function useNotebookMotion(preset = "rise", delay = 0, reveal = false) {
  const reduce = useReducedMotion();
  const isPresent = useIsPresent();
  const settings = PRESETS[preset] ?? PRESETS.rise;
  const { from, to, leave = from, keep = false } = settings;
  const moves = Boolean(from);
  const visible = {
    opacity: 1,
    ...(moves ? { transform: to } : {}),
    ...(moves && !keep ? { transitionEnd: { transform: "none" } } : {}),
  };

  return {
    "data-motion": preset,
    inert: !isPresent || undefined,
    "aria-hidden": !isPresent || undefined,
    initial: reduce ? false : { opacity: 0, ...(moves ? { transform: from } : {}) },
    ...(reveal && !reduce
      ? { whileInView: visible, viewport: { once: true, amount: 0.12 } }
      : { animate: visible }),
    exit: {
      opacity: 0,
      ...(moves && !reduce ? { transform: leave } : {}),
      transition: { duration: reduce ? 0 : LEAVE_DURATION, ease: LEAVE_EASE, delay: 0 },
    },
    transition: reduce ? { duration: 0 } : enterTransition(settings, delay),
  };
}

import { useIsPresent, useReducedMotion } from "motion/react";

const EASE = [0.22, 1, 0.36, 1];
// Leaving eases in and out, so a dismissed surface fades away instead of
// being cut off.
const LEAVE_EASE = [0.4, 0, 0.2, 1];
const LEAVE_DURATION = 0.18;
// A soft spring with almost no overshoot: the sheet settles rather than bounces.
const SETTLE = { type: "spring", bounce: 0.1, visualDuration: 0.38 };
const PRESETS = {
  rise: { offset: { y: 8 }, rest: { y: 0 }, duration: 0.42 },
  step: { offset: { x: 12 }, rest: { x: 0 }, duration: 0.36 },
  // Menus unfold from their trigger (transform-origin in notebookMotion.css).
  menu: { offset: { y: -4, scale: 0.97 }, rest: { y: 0, scale: 1 }, duration: 0.26 },
  "menu-above": { offset: { y: 4, scale: 0.97 }, rest: { y: 0, scale: 1 }, duration: 0.26 },
  // A sheet laid on the desk: it arrives a little turned and straightens as it
  // settles, then lifts straight off when dismissed.
  dialog: {
    offset: { y: 14, scale: 0.97, rotate: -0.6 },
    rest: { y: 0, scale: 1, rotate: 0 },
    leave: { y: 8, scale: 0.98 },
    duration: 0.38,
    spring: SETTLE,
  },
  scrim: { offset: {}, rest: {}, duration: 0.24 },
  toast: { offset: { x: "50%", y: 12 }, rest: { x: "50%", y: 0 }, duration: 0.36 },
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
  const { offset, rest, leave = offset } = settings;
  const visible = { opacity: 1, ...rest };

  return {
    "data-motion": preset,
    inert: !isPresent || undefined,
    "aria-hidden": !isPresent || undefined,
    initial: reduce ? false : { opacity: 0, ...offset },
    ...(reveal && !reduce
      ? { whileInView: visible, viewport: { once: true, amount: 0.12 } }
      : { animate: visible }),
    exit: {
      opacity: 0,
      ...(reduce ? rest : { ...rest, ...leave }),
      transition: { duration: reduce ? 0 : LEAVE_DURATION, ease: LEAVE_EASE, delay: 0 },
    },
    transition: reduce ? { duration: 0 } : enterTransition(settings, delay),
  };
}

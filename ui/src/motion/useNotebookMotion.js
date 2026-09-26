import { useIsPresent, useReducedMotion } from "motion/react";

const EASE = [0.22, 1, 0.36, 1];
const PRESETS = {
  rise: { offset: { y: 8 }, rest: { y: 0 }, duration: 0.32 },
  step: { offset: { x: 12 }, rest: { x: 0 }, duration: 0.28 },
  menu: { offset: { y: -5, scale: 0.985 }, rest: { y: 0, scale: 1 }, duration: 0.2 },
  "menu-above": { offset: { y: 5, scale: 0.985 }, rest: { y: 0, scale: 1 }, duration: 0.2 },
  dialog: { offset: { y: 12, scale: 0.985 }, rest: { y: 0, scale: 1 }, duration: 0.28 },
  scrim: { offset: {}, rest: {}, duration: 0.18 },
  toast: { offset: { x: "50%", y: 12 }, rest: { x: "50%", y: 0 }, duration: 0.28 },
};

// A single vocabulary for entry, state change and dismissal. Exiting UI becomes
// inert immediately, so retained animation frames cannot receive stale actions.
export default function useNotebookMotion(preset = "rise", delay = 0, reveal = false) {
  const reduce = useReducedMotion();
  const isPresent = useIsPresent();
  const { offset, rest, duration } = PRESETS[preset] ?? PRESETS.rise;
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
      ...(reduce ? rest : offset),
      transition: { duration: reduce ? 0 : 0.12, ease: EASE, delay: 0 },
    },
    transition: { duration: reduce ? 0 : duration, delay: reduce ? 0 : delay, ease: EASE },
  };
}

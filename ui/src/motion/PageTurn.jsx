"use client";

import { m, useIsPresent, useReducedMotion } from "motion/react";

const EASE = [0.22, 1, 0.36, 1];
const LEAVE_EASE = [0.4, 0, 0.2, 1];

/*
 * The page tabs are siblings, so moving between them slides sideways: a tab to
 * the right brings its page in from the right, and the old page slips a little
 * the other way as it fades. The exit is quicker than the entrance, and neither
 * travels far enough to read as a page flip. `turn` is -1, 0 or 1; AnimatePresence
 * passes the newest value to the exiting page through `custom`. Like the other
 * exiting surfaces, the old page is inert while it leaves.
 */
function PageTurn({ turn = 0, children, ...props }) {
  const reduce = useReducedMotion();
  const isPresent = useIsPresent();
  const variants = {
    enter: (direction) => ({ opacity: 0, x: reduce ? 0 : direction * 18 }),
    shown: {
      opacity: 1,
      x: 0,
      transition: { duration: reduce ? 0 : 0.34, ease: EASE },
    },
    leave: (direction) => ({
      opacity: 0,
      x: reduce ? 0 : direction * -12,
      transition: { duration: reduce ? 0 : 0.16, ease: LEAVE_EASE },
    }),
  };

  return (
    <m.div
      {...props}
      data-motion="page"
      inert={!isPresent || undefined}
      custom={turn}
      variants={variants}
      initial="enter"
      animate="shown"
      exit="leave"
    >
      {children}
    </m.div>
  );
}

export default PageTurn;

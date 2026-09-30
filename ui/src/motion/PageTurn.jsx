"use client";

import { useContext, useMemo } from "react";
import { m, PresenceContext, useIsPresent, useReducedMotion } from "motion/react";

const EASE = [0.22, 1, 0.36, 1];
const LEAVE_EASE = [0.4, 0, 0.2, 1];

/*
 * The page tabs are siblings, so moving between them slides sideways: a tab to
 * the right brings its page in from the right, and the old page slips a little
 * the other way as it fades. The exit is quicker than the entrance, and neither
 * travels far enough to read as a page flip. `turn` is -1, 0 or 1; AnimatePresence
 * passes the newest value to the exiting page through `custom`. Like the other
 * exiting surfaces, the old page is inert while it leaves. The slide is a
 * transform string, so the compositor runs it even while the new page is
 * still being rendered, and it is cleared once the page has arrived.
 *
 * Only the page leaves: the cards and notes on it stay as they are while it
 * slides away, rather than each playing its own exit on top (which would add
 * a dozen animations and a drift downwards to the turn, and hold it until
 * the slowest had finished). They still see whether the notebook was just
 * opened, so the first page shows without its cards rising in.
 */
function PageTurn({ turn = 0, children, ...props }) {
  const reduce = useReducedMotion();
  const isPresent = useIsPresent();
  const presence = useContext(PresenceContext);
  const settled = useMemo(() => (presence
    ? { ...presence, isPresent: true, register: () => () => {}, onExitComplete: undefined }
    : null), [presence]);
  const variants = {
    enter: (direction) => ({
      opacity: 0,
      transform: `translateX(${reduce ? 0 : direction * 18}px)`,
    }),
    shown: {
      opacity: 1,
      transform: "translateX(0px)",
      transition: { duration: reduce ? 0 : 0.34, ease: EASE },
      transitionEnd: { transform: "none" },
    },
    leave: (direction) => ({
      opacity: 0,
      transform: `translateX(${reduce ? 0 : direction * -12}px)`,
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
      <PresenceContext.Provider value={settled}>{children}</PresenceContext.Provider>
    </m.div>
  );
}

export default PageTurn;

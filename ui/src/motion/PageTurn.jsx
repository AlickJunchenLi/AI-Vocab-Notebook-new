"use client";

import { useContext, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { m, PresenceContext, useIsPresent, useReducedMotion } from "motion/react";
import { contentGroups, revealContent } from "./contentReveal.js";

const EASE = [0.22, 1, 0.36, 1];
const LEAVE_EASE = [0.4, 0, 0.2, 1];
// The new page's surfaces fade in over this long; what is on them starts to
// be uncovered part-way through (contentReveal.js).
const SURFACES_IN = 0.3;
const CONTENT = { at: 180, spread: 420, gap: 60, duration: 600 };

/*
 * Turning to another page. The old page slips a little sideways as it fades
 * (towards the tab you left it by: `turn` is -1, 0 or 1, and AnimatePresence
 * passes the newest value to the exiting page through `custom`), quickly and
 * not far enough to read as a page flip; it is inert while it leaves. The
 * new page then comes in the way the day's welcome ends: its surfaces fade
 * in still blank, and what is on them is uncovered group by group, left to
 * right, in reading order. The first page, when the notebook opens, simply
 * shows (or is brought in by the welcome).
 *
 * Only the page leaves: the cards and notes on it stay as they are while it
 * slides away, rather than each playing its own exit on top (which would add
 * a dozen animations and a drift downwards to the turn, and hold it until
 * the slowest had finished). They still see whether the notebook was just
 * opened, so the first page shows without its cards rising in; but only while
 * that page first renders. Motion reads this when a card is created, so a
 * card that appears on the page later (a meaning revealed, the next word)
 * still plays its entrance.
 */
function PageTurn({ turn = 0, children, ...props }) {
  const pageRef = useRef(null);
  const reduce = useReducedMotion();
  const isPresent = useIsPresent();
  const presence = useContext(PresenceContext);
  const mounted = useRef(false);
  const settled = useMemo(() => (presence
    ? {
      ...presence,
      get initial() {
        return mounted.current ? undefined : presence.initial;
      },
      isPresent: true,
      register: () => () => {},
      onExitComplete: undefined,
    }
    : null), [presence]);

  useEffect(() => {
    mounted.current = true;
  }, []);

  // A page turned to (not the first one) holds back its content while its
  // surfaces come in, then uncovers it.
  const turnedTo = presence?.initial !== false;
  useLayoutEffect(() => {
    if (!turnedTo || reduce || !pageRef.current) {
      return undefined;
    }

    const animations = revealContent(contentGroups(pageRef.current), CONTENT);
    return () => animations.forEach((animation) => animation.cancel());
  }, [turnedTo, reduce]);

  const variants = {
    enter: { opacity: 0 },
    shown: {
      opacity: 1,
      transition: { duration: reduce ? 0 : SURFACES_IN, ease: EASE },
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
      ref={pageRef}
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

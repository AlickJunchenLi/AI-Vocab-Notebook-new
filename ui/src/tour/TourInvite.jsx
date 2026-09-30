"use client";

import { m, useIsPresent, useReducedMotion } from "motion/react";
import "./tour.css";

const EASE = [0.22, 1, 0.36, 1];

/*
 * A note left on Today the first time the notebook is opened, offering the
 * tour. It never starts the tour by itself; "Not now" puts it away for good,
 * and the header's Tour button is always there. Leaving, it folds its height
 * away so the page closes up smoothly instead of jumping.
 */
function TourInvite({ onStart, onDismiss }) {
  const reduce = useReducedMotion();
  const isPresent = useIsPresent();

  return (
    <m.aside
      className="tour-invite"
      aria-labelledby="tour-invite-title"
      inert={!isPresent || undefined}
      // Clipped only while it folds away, so its shadow shows the rest of the time.
      style={isPresent ? undefined : { overflow: "hidden" }}
      initial={reduce ? false : { opacity: 0, transform: "translateY(8px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)", transitionEnd: { transform: "none" } }}
      exit={reduce
        ? { opacity: 0, transition: { duration: 0 } }
        : { opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.26, ease: EASE } }}
      transition={{ duration: reduce ? 0 : 0.32, delay: reduce ? 0 : 0.08, ease: EASE }}
    >
      <div className="tour-invite-slip">
        <div className="tour-invite-copy">
          <h2 id="tour-invite-title" className="tour-title">New here?</h2>
          <p>A one-minute tour shows where your words go, how practice works and how to change the look.</p>
        </div>
        <div className="tour-invite-actions">
          <button type="button" className="secondary-button" onClick={onDismiss}>
            Not now
          </button>
          <button type="button" className="primary-action" onClick={onStart}>
            Show me around
          </button>
        </div>
      </div>
    </m.aside>
  );
}

export default TourInvite;

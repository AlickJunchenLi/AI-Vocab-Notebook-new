"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { m, useIsPresent, useReducedMotion, useSpring } from "motion/react";
import Icon from "../components/Icon.jsx";
import { useDialogFocus } from "../hooks/useDialogFocus.js";
import { TOUR_STEPS } from "./tourSteps.js";
import { placeNote, spotlightFor } from "./placeNote.js";
import "./tour.css";

const EASE = [0.22, 1, 0.36, 1];
// The spotlight and the note glide to each new target without overshooting.
const GLIDE = { stiffness: 260, damping: 34, mass: 1 };
// After a step changes, its target is followed for this long while the page
// turns and scrolls it into place; a step whose target never appears falls
// back to a centred note.
const FOLLOW_FOR = 900;
const GIVE_UP_AFTER = 1600;

function findTarget(selectors) {
  for (const selector of selectors) {
    for (const element of document.querySelectorAll(selector)) {
      if (!element.closest("[inert]") && element.getClientRects().length > 0) {
        return element;
      }
    }
  }

  return null;
}

// Scroll only when the target isn't already comfortably in view. "auto"
// follows the page's scroll-behavior: smooth, or instant under reduced motion.
function bringIntoView(element, step) {
  const behavior = "auto";

  if (step.scrollTop) {
    if (window.scrollY > 0) {
      window.scrollTo({ top: 0, behavior });
    }
    return;
  }

  const rect = element.getBoundingClientRect();
  const top = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  const docked = window.innerWidth < 560;
  const bottom = window.innerHeight * (docked ? 0.55 : 0.92);
  const atStart = step.align === "start" ? rect.top <= top + 24 : rect.top >= top;

  if (atStart && rect.top >= top - 1 && rect.bottom <= bottom) {
    return;
  }

  const tall = rect.height > (bottom - top) * 0.8;
  element.scrollIntoView({
    block: tall || docked || step.align === "start" ? "start" : "center",
    behavior,
  });
}

/*
 * The guided tour: a short run of notes, each pinned beside one part of the
 * notebook, which is lit and circled in ink while the rest of the page dims.
 * Steps on another page turn the notebook to it first. The note is a dialog:
 * focus stays in it, Escape or the close button ends the tour, and the arrow
 * keys step back and forth.
 */
function TourGuide({ activePage, onNavigate, onClose }) {
  const [index, setIndex] = useState(0);
  const step = TOUR_STEPS[index];
  const isLast = index === TOUR_STEPS.length - 1;
  const reduce = useReducedMotion();
  const isPresent = useIsPresent();
  // Started from the invitation, which is gone by the end: focus then goes to
  // the header's Tour button.
  const noteRef = useDialogFocus(onClose, ".tour-toggle");
  const titleId = useId();
  const bodyId = useId();
  const placed = useRef(false);

  const spotX = useSpring(0, GLIDE);
  const spotY = useSpring(0, GLIDE);
  const spotWidth = useSpring(0, GLIDE);
  const spotHeight = useSpring(0, GLIDE);
  const noteX = useSpring(0, GLIDE);
  const noteY = useSpring(0, GLIDE);

  const goTo = useCallback((next) => {
    setIndex(Math.min(Math.max(next, 0), TOUR_STEPS.length - 1));
  }, []);

  // Each step belongs to a page; turn to it first.
  useEffect(() => {
    if (isPresent && step.page !== activePage) {
      onNavigate(step.page);
    }
  }, [isPresent, step.page, activePage, onNavigate]);

  // Find the step's target, bring it into view and keep the spotlight and the
  // note on it while it settles. Positions go straight to motion values, so
  // following the target never re-renders the tour.
  useEffect(() => {
    const note = noteRef.current;

    if (!isPresent || !note) {
      return undefined;
    }

    const values = [spotX, spotY, spotWidth, spotHeight, noteX, noteY];
    let frame = 0;
    let target = null;
    let scrolled = false;
    let followUntil = 0;
    const startedAt = performance.now();

    function place(rect) {
      const view = { width: window.innerWidth, height: window.innerHeight };
      const spot = spotlightFor(rect, view);
      const lit = rect ? {
        left: spot.x,
        top: spot.y,
        right: spot.x + spot.width,
        bottom: spot.y + spot.height,
        width: spot.width,
        height: spot.height,
      } : null;
      const where = placeNote(lit, { width: note.offsetWidth, height: note.offsetHeight }, view, step.sides);

      // A note docked along the foot of a phone screen covers the bottom of a
      // tall target, so the lit part stops just above it.
      if (where.side === "dock" && rect) {
        spot.height = Math.max(Math.min(spot.height, where.y - 10 - spot.y), 0);
      }

      const next = [spot.x, spot.y, spot.width, spot.height, where.x, where.y];

      // The first placement, and every placement under reduced motion, is
      // immediate; after that the spotlight and note glide.
      values.forEach((value, position) => {
        if (reduce || !placed.current) {
          value.jump(next[position]);
        } else {
          value.set(next[position]);
        }
      });
      placed.current = true;
      note.dataset.side = where.side;
      note.style.setProperty("--tour-arrow", `${where.arrow}px`);
    }

    function tick(now) {
      frame = 0;

      if (!target || !target.isConnected || target.closest("[inert]")) {
        target = findTarget(step.target);
        scrolled = false;
      }

      // Scroll once the notebook has finished growing to the new page, so a
      // page that is still short can't cut the scroll off early.
      if (target && !scrolled && !document.querySelector(".page-frame[data-turning]")) {
        bringIntoView(target, step);
        scrolled = true;
        followUntil = now + FOLLOW_FOR;
      }

      if (target) {
        place(target.getBoundingClientRect());
      } else if (now - startedAt > GIVE_UP_AFTER) {
        place(null);
        return;
      }

      if (!target || !scrolled || now < followUntil) {
        frame = window.requestAnimationFrame(tick);
      }
    }

    function follow() {
      followUntil = performance.now() + 300;

      if (!frame) {
        frame = window.requestAnimationFrame(tick);
      }
    }

    frame = window.requestAnimationFrame(tick);
    window.addEventListener("resize", follow);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", follow);
    };
  }, [index, step, reduce, isPresent, noteRef, spotX, spotY, spotWidth, spotHeight, noteX, noteY]);

  function handleKeyDown(event) {
    if (event.key === "ArrowRight" && !isLast) {
      event.preventDefault();
      goTo(index + 1);
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      goTo(index - 1);
    }
  }

  return (
    <m.div
      className="tour"
      data-motion="tour"
      inert={!isPresent || undefined}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.2, ease: [0.4, 0, 0.2, 1] } }}
      transition={{ duration: reduce ? 0 : 0.3, ease: EASE }}
    >
      <div className="tour-blocker" aria-hidden="true" />

      <m.div
        className="tour-spotlight"
        aria-hidden="true"
        style={{ x: spotX, y: spotY, width: spotWidth, height: spotHeight }}
      >
        <svg key={step.id} className="tour-pen" focusable="false">
          <rect width="100%" height="100%" rx="11" pathLength="1" />
        </svg>
      </m.div>

      <m.section
        ref={noteRef}
        className="tour-note"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        style={{ x: noteX, y: noteY }}
        onKeyDown={handleKeyDown}
      >
        <button type="button" className="close-button tour-close" aria-label="End the tour" onClick={onClose}>
          <Icon name="x" size={16} />
        </button>

        <div className="tour-copy" aria-live="polite">
          <m.div
            key={step.id}
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : 0.3, ease: EASE }}
          >
            <h2 id={titleId} className="tour-title">{step.title}</h2>
            <p id={bodyId} className="tour-body">{step.body}</p>
            {step.keys ? (
              <p className="tour-keys">
                {step.keys.map(([key, label]) => (
                  <span key={key}><kbd>{key}</kbd> {label}</span>
                ))}
              </p>
            ) : null}
          </m.div>
        </div>

        <div className="tour-footer">
          <span className="tour-count">{index + 1} of {TOUR_STEPS.length}</span>
          {index > 0 ? (
            <button type="button" className="secondary-button tour-back" onClick={() => goTo(index - 1)}>
              Back
            </button>
          ) : null}
          <button
            type="button"
            className="primary-action tour-next"
            data-autofocus
            onClick={() => (isLast ? onClose() : goTo(index + 1))}
          >
            {isLast ? "Finish" : "Next"}
          </button>
        </div>
      </m.section>
    </m.div>
  );
}

export default TourGuide;

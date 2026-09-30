"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { m, useIsPresent, useMotionValue, useReducedMotion } from "motion/react";
import Icon from "../components/Icon.jsx";
import { useDialogFocus } from "../hooks/useDialogFocus.js";
import { TOUR_STEPS } from "./tourSteps.js";
import { placeNote, spotlightFor } from "./placeNote.js";
import "./tour.css";

const EASE = [0.22, 1, 0.36, 1];
// A step whose target never appears falls back to a centred note.
const GIVE_UP_AFTER = 1600;
const GEOMETRY_PROPERTIES = new Set([
  "transform", "translate", "scale", "rotate", "width", "height",
  "minWidth", "maxWidth", "minHeight", "maxHeight", "top", "right", "bottom", "left",
  "marginTop", "marginRight", "marginBottom", "marginLeft", "paddingTop", "paddingBottom",
]);

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

// Finish scrolling before measuring the destination. A smooth scroll would
// move the target underneath its indicator and give the step two placements.
function bringIntoView(element, step) {
  const behavior = "instant";

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

function isTargetSettling(target) {
  const frame = target.closest(".page-frame");

  if (frame?.matches("[data-turning], [data-settling]")) {
    return true;
  }

  // Incoming pages and cards slide in independently. Their visual bounds
  // become the destination only after those entrances have finished.
  for (let element = target; element && element !== document.body; element = element.parentElement) {
    if (element.getAnimations().some((animation) => {
      const effect = animation.effect;
      // The header's scroll-driven shadow never finishes, but does not move
      // the target. Only finite animations of actual geometry hold placement.
      return (animation.playState === "running" || animation.pending) &&
        animation.timeline === document.timeline && effect &&
        Number.isFinite(effect.getComputedTiming().endTime) &&
        effect.getKeyframes().some((keyframe) => Object.keys(keyframe).some((property) => GEOMETRY_PROPERTIES.has(property)));
    })) {
      return true;
    }
  }

  return false;
}

/*
 * The guided tour: a short run of notes, each pinned beside one part of the
 * notebook, which is lit and circled in ink while the rest of the page dims.
 * Steps on another page turn the notebook to it first. The note is a dialog:
 * focus stays in it, Escape or the close button ends the tour, and the arrow
 * keys step back and forth.
 */
function TourGuide({ activePage, onNavigate, onClose }) {
  const [selection, setSelection] = useState({ index: 0, request: 0 });
  const { index, request } = selection;
  const step = TOUR_STEPS[index];
  const isLast = index === TOUR_STEPS.length - 1;
  const [positionedTarget, setPositionedTarget] = useState(null);
  const positioned = positionedTarget?.request === request && positionedTarget?.page === activePage;
  const reduce = useReducedMotion();
  const isPresent = useIsPresent();
  // Started from the invitation, which is gone by the end: focus then goes to
  // the header's Tour button.
  const noteRef = useDialogFocus(onClose, ".tour-toggle");
  const titleId = useId();
  const bodyId = useId();
  const spotX = useMotionValue(0);
  const spotY = useMotionValue(0);
  const spotWidth = useMotionValue(0);
  const spotHeight = useMotionValue(0);
  const noteX = useMotionValue(0);
  const noteY = useMotionValue(0);

  const goTo = useCallback((next) => {
    const nextIndex = Math.min(Math.max(next, 0), TOUR_STEPS.length - 1);
    setSelection((previous) => previous.index === nextIndex ? previous : {
      index: nextIndex,
      request: previous.request + 1,
    });
  }, []);

  // Each step belongs to a page; turn to it first.
  useEffect(() => {
    if (isPresent && step.page !== activePage) {
      onNavigate(step.page);
    }
  }, [isPresent, step.page, activePage, onNavigate]);

  // Prepare the page and scroll first, then show the instruction at its final
  // destination. Later geometry changes are followed directly, without a
  // spring trailing behind the target or switching the arrow mid-flight.
  useEffect(() => {
    const note = noteRef.current;

    if (!isPresent || !note) {
      return undefined;
    }

    const values = [spotX, spotY, spotWidth, spotHeight, noteX, noteY];
    let frame = 0;
    let target = null;
    let scrolled = false;
    let shown = false;
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

      values.forEach((value, position) => {
        value.set(next[position]);
      });
      note.dataset.side = where.side;
      note.style.setProperty("--tour-arrow", `${where.arrow}px`);

      if (!shown) {
        shown = true;
        // Motion values render on the next frame. Reveal only after those
        // styles land, so the note never flashes at the previous coordinates.
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          setPositionedTarget({ request, page: activePage });
        });
      }
    }

    function tick(now) {
      frame = 0;

      if (!target || !target.isConnected || target.closest("[inert]")) {
        if (target) sizes?.unobserve(target);
        target = findTarget(step.target);
        if (target) sizes?.observe(target);
        scrolled = false;
      }

      if (activePage !== step.page || !target) {
        if (now - startedAt > GIVE_UP_AFTER) {
          place(null);
          return;
        }
        frame = window.requestAnimationFrame(tick);
        return;
      }

      if (!scrolled) {
        // A page that is still short can clamp the scroll before the new
        // target fits. Also avoid measuring the incoming page's transform.
        if (!isTargetSettling(target) || now - startedAt > GIVE_UP_AFTER) {
          bringIntoView(target, step);
          scrolled = true;
        }
        frame = window.requestAnimationFrame(tick);
        return;
      }

      place(target.getBoundingClientRect());
    }

    function follow() {
      if (!frame) {
        frame = window.requestAnimationFrame(tick);
      }
    }

    function resize() {
      scrolled = false;
      follow();
    }

    const sizes = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(follow);
    sizes?.observe(note);
    frame = window.requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", follow, { passive: true, capture: true });

    return () => {
      window.cancelAnimationFrame(frame);
      sizes?.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", follow, true);
    };
  }, [request, step, activePage, isPresent, noteRef, spotX, spotY, spotWidth, spotHeight, noteX, noteY]);

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
      data-locating={!positioned || undefined}
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
        <svg key={`${step.id}-${positioned}`} className="tour-pen" focusable="false">
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
        aria-busy={!positioned}
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
            initial={reduce ? false : { opacity: 0, transform: "translateY(4px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)", transitionEnd: { transform: "none" } }}
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

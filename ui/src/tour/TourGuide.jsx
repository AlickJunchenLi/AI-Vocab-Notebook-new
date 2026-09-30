"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { animate, m, useIsPresent, useMotionValue, useReducedMotion } from "motion/react";
import Icon from "../components/Icon.jsx";
import { useDialogFocus } from "../hooks/useDialogFocus.js";
import { TOUR_STEPS } from "./tourSteps.js";
import { placeNote, spotlightFor } from "./placeNote.js";
import "./tour.css";

const EASE = [0.22, 1, 0.36, 1];
// The highlight and its note glide between targets, easing in and out.
const GLIDE_EASE = [0.4, 0, 0.2, 1];
// A step whose target never appears falls back to a centred note.
const GIVE_UP_AFTER = 1600;
// The page scrolls only when less than this share of the target is on
// screen; otherwise it stays still and the highlight goes to the target.
const SHOWN_ENOUGH = 0.6;
// A scroll the page can't finish (it is too short) stops being waited on.
const SCROLL_WAIT = 1000;

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

/*
 * The target's box in the window as laid out, before any transform: where it
 * comes to rest once the page turning in and its own entrance have finished.
 * Aiming for this rather than the moving box lets the highlight set off while
 * the page is still arriving, without following it on the way. `scrollY` is
 * the page's scroll to measure it at.
 */
function restingRect(element, scrollY = window.scrollY) {
  let left = 0;
  let top = 0;
  let outermost = element;

  for (let node = element; node; node = node.offsetParent) {
    left += node.offsetLeft + (node === element ? 0 : node.clientLeft);
    top += node.offsetTop + (node === element ? 0 : node.clientTop);
    outermost = node;
  }

  for (let node = element.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
    left -= node.scrollLeft;
    top -= node.scrollTop;
  }

  // Offsets end at the page, or at the window for a fixed ancestor.
  if (getComputedStyle(outermost).position !== "fixed") {
    left -= window.scrollX;
    top -= scrollY;
  }

  const width = element.offsetWidth;
  const height = element.offsetHeight;
  return { left, top, width, height, right: left + width, bottom: top + height };
}

// Where to scroll so the step's target (at `rect`) can be seen, or null to
// leave the page where it is. A target that is mostly on screen is lit where
// it stands; the page moves only for one that is mostly out of sight. The
// result can lie past the end of a page that is still growing.
function scrollFor(rect, step) {
  // Header targets count from the top of the window, the rest from below the
  // sticky header.
  const top = step.scrollTop ? 0 : parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  const docked = window.innerWidth < 560;
  // A note docked along the foot of a phone screen covers its lower part.
  const bottom = window.innerHeight * (docked ? 0.55 : 1);
  const visible = Math.min(rect.bottom, bottom) - Math.max(rect.top, top);

  if (visible >= Math.min(rect.height, bottom - top) * SHOWN_ENOUGH) {
    return null;
  }

  const tall = rect.height > (bottom - top) * 0.8;
  let offset = rect.top + rect.height / 2 - (top + bottom) / 2;

  if (step.scrollTop) {
    offset = -window.scrollY;
  } else if (tall || docked) {
    offset = rect.top - top;
  }

  return Math.max(window.scrollY + offset, 0);
}

// A scroll position the page can actually reach, or null if it is already there.
function reachable(top) {
  const limit = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
  const next = Math.min(top, limit);
  return Math.abs(next - window.scrollY) < 1 ? null : next;
}

// Longer moves take a little longer, so every glide feels equally unhurried.
function glideFor(from, to) {
  const distance = Math.max(...to.map((value, position) => Math.abs(value - from[position])));
  return { duration: Math.min(0.45 + distance / 2000, 0.75), ease: GLIDE_EASE };
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
  // The step the highlight last arrived at. Until the first arrival nothing
  // is shown; after it, the highlight stays up and glides between steps.
  const [positionedTarget, setPositionedTarget] = useState(null);
  const positioned = positionedTarget?.request === request && positionedTarget?.page === activePage;
  const hasPlaced = useRef(false);
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

  // As soon as the step's page is up, the highlight and the note glide once,
  // from where they were straight to where the target comes to rest, while
  // the page is still turning in. After that they follow it directly, so
  // they never trail behind the page or drift through the places it passes
  // on the way. The page scrolls only when the target is out of sight.
  useEffect(() => {
    const note = noteRef.current;

    if (!isPresent || !note) {
      return undefined;
    }

    const values = [spotX, spotY, spotWidth, spotHeight, noteX, noteY];
    let frame = 0;
    let target = null;
    let checked = false;
    let scrolling = null;
    let placed = false;
    let arrived = false;
    // The destination of a glide on its way, and where its arrow will point.
    let heading = null;
    let latest = null;
    let glide = 0;
    let cancelled = false;
    const startedAt = performance.now();

    function point(where) {
      note.dataset.side = where.side;
      note.style.setProperty("--tour-arrow", `${where.arrow}px`);
    }

    function arrive() {
      arrived = true;
      heading = null;
      point(latest);
      setPositionedTarget({ request, page: activePage });
    }

    function glideTo(next) {
      const run = ++glide;
      const transition = glideFor(values.map((value) => value.get()), next);

      heading = next;
      Promise.all(values.map((value, position) => animate(value, next[position], transition))).then(() => {
        if (!cancelled && run === glide) {
          arrive();
        }
      });
    }

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
      latest = where;

      // Already on the way: steer toward where the target is now.
      if (heading) {
        if (next.some((value, position) => Math.abs(value - heading[position]) > 0.5)) {
          glideTo(next);
        }
        return;
      }

      if (hasPlaced.current && !arrived && !reduce) {
        glideTo(next);
        return;
      }

      values.forEach((value, position) => {
        value.jump(next[position]);
      });

      if (arrived) {
        point(where);
        return;
      }

      hasPlaced.current = true;
      // Motion values render on the next frame. Reveal only after those
      // styles land, so the note never flashes at the previous coordinates.
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (!cancelled) arrive();
      });
    }

    // Scrolls to the target if it is out of sight. Returns false while that
    // has to wait: a page still growing as it turns in can cut a scroll short.
    function bringIntoView(now) {
      const wanted = scrollFor(restingRect(target), step);

      if (wanted === null) {
        return true;
      }

      if (target.closest(".page-frame:is([data-turning], [data-settling])") && now - startedAt < GIVE_UP_AFTER) {
        return false;
      }

      const top = reachable(wanted);

      if (top === null) {
        return true;
      }

      scrolling = { top, until: now + SCROLL_WAIT };
      window.scrollTo({ top, behavior: reduce ? "instant" : "smooth" });
      return true;
    }

    // Where the target will be once any scroll toward it has finished, so a
    // glide made during the scroll heads for its end instead of chasing it.
    function destination(now) {
      if (scrolling && (Math.abs(window.scrollY - scrolling.top) < 1 || now >= scrolling.until)) {
        scrolling = null;
      }

      return restingRect(target, scrolling?.top);
    }

    function tick(now) {
      frame = 0;

      if (!target || !target.isConnected || target.closest("[inert]")) {
        if (target) sizes?.unobserve(target);
        target = findTarget(step.target);
        if (target) sizes?.observe(target);
        checked = placed;
      }

      if (activePage !== step.page || !target) {
        if (now - startedAt > GIVE_UP_AFTER) {
          place(null);
          return;
        }
        frame = window.requestAnimationFrame(tick);
        return;
      }

      if (!checked) {
        if (!bringIntoView(now)) {
          frame = window.requestAnimationFrame(tick);
          return;
        }
        checked = true;
      }

      placed = true;
      place(destination(now));

      // Keep checking until the scroll ends, even if it sends no more events.
      if (scrolling) {
        frame = window.requestAnimationFrame(tick);
      }
    }

    function follow() {
      if (!frame) {
        frame = window.requestAnimationFrame(tick);
      }
    }

    function resize() {
      const wanted = placed && target ? scrollFor(restingRect(target), step) : null;
      const top = wanted === null ? null : reachable(wanted);

      if (top !== null) {
        window.scrollTo({ top, behavior: "instant" });
      }
      follow();
    }

    const sizes = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(follow);
    sizes?.observe(note);
    frame = window.requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", follow, { passive: true, capture: true });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      sizes?.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", follow, true);
    };
  }, [request, step, activePage, isPresent, reduce, noteRef, spotX, spotY, spotWidth, spotHeight, noteX, noteY]);

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
      data-placing={!positionedTarget || undefined}
      data-moving={!positioned || undefined}
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
        {/* The ring of the step it last arrived at; a new one is drawn on arrival. */}
        <svg key={positionedTarget?.request ?? "none"} className="tour-pen" focusable="false">
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

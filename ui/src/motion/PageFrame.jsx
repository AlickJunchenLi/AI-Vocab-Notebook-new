import { useEffect, useLayoutEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { isSmoothingLayout } from "./useSmoothLayout.js";

// Longest a turn can hold the frame, in case the new page is exactly as tall
// as the old one and never reports a change of size.
const RELEASE_AFTER = 900;
// A change of height smaller than this in one frame is part of something
// already moving (a note folding away, a card easing open), so the frame
// simply follows it; anything larger is a jump and is eased.
const JUMP = 12;
const SETTLE_TIME = 360;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

// Back to the page's natural height.
function release(frame) {
  window.clearTimeout(Number(frame.dataset.turning));
  frame.style.height = "";
  delete frame.dataset.turning;
}

/*
 * The page area of the notebook. When the page changes, the frame holds the
 * old page's height while it leaves, then eases to the new page's height
 * (`transition: height` on [data-turning] in notebookMotion.css), so the
 * notebook grows or shrinks, rings and all, instead of jumping. The frame
 * clips the new page's lower edge while it grows, as if the page unrolled,
 * and goes back to its natural height once it arrives. While a turn is under
 * way, data-turning holds the id of the timer that ends it.
 *
 * Within a page, the same goes for any sudden change of height (a practice
 * session finishing, say): the frame eases to the new height, so the foot of
 * the notebook, its footer and its rings glide rather than jump. Changes
 * already being eased inside the page (useSmoothLayout.js) are followed as
 * they are, and a change of width (the window resizing) is never eased.
 */
function PageFrame({ page, children }) {
  const frameRef = useRef(null);
  const contentRef = useRef(null);
  const shownPage = useRef(page);
  const reduce = useReducedMotion();

  // Hold the frame at its current height before the browser paints the turn.
  useLayoutEffect(() => {
    const frame = frameRef.current;

    if (!frame || shownPage.current === page) {
      return;
    }

    shownPage.current = page;

    if (reduce) {
      return;
    }

    if (frame.dataset.turning) {
      window.clearTimeout(Number(frame.dataset.turning));
    }

    // An ease still running (see below) gives way to the turn, from where it is.
    const height = frame.getBoundingClientRect().height;
    for (const animation of frame.getAnimations()) {
      // A turn already easing (a CSS transition) is retargeted, not cut.
      if (!("transitionProperty" in animation)) {
        animation.cancel();
      }
    }

    frame.style.height = `${height}px`;
    frame.dataset.turning = String(window.setTimeout(() => release(frame), RELEASE_AFTER));
  }, [page, reduce]);

  // When the new page arrives its height differs: ease the frame towards it.
  useEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;

    if (!frame || !content || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let shown = { width: content.offsetWidth, height: content.offsetHeight };
    let settling = null;

    function settle(from, to) {
      const animation = frame.animate(
        [{ height: `${from}px` }, { height: `${to}px` }],
        { duration: SETTLE_TIME, easing: EASE },
      );
      const done = () => {
        if (settling === animation) {
          settling = null;
          delete frame.dataset.settling;
        }
      };

      settling = animation;
      frame.dataset.settling = "";
      animation.addEventListener("finish", done);
      animation.addEventListener("cancel", done);
    }

    const observer = new ResizeObserver(() => {
      const height = content.offsetHeight;
      const width = content.offsetWidth;

      if (frame.dataset.turning) {
        if (Math.abs(height - parseFloat(frame.style.height)) >= 1) {
          frame.style.height = `${height}px`;
        }
      } else if (settling || (
        Math.abs(height - shown.height) >= JUMP &&
        width === shown.width &&
        !isSmoothingLayout() &&
        !reducedMotion.matches
      )) {
        // Start from the height drawn now, part-way through an ease if one is
        // running, so a second change never jumps.
        const from = settling ? frame.offsetHeight : shown.height;
        settling?.cancel();

        if (Math.abs(height - from) >= 1) {
          settle(from, height);
        }
      }

      shown = { width, height };
    });

    function handleTransitionEnd(event) {
      if (event.target === frame && event.propertyName === "height") {
        release(frame);
      }
    }

    observer.observe(content);
    frame.addEventListener("transitionend", handleTransitionEnd);

    return () => {
      observer.disconnect();
      settling?.cancel();
      frame.removeEventListener("transitionend", handleTransitionEnd);
      if (frame.dataset.turning) {
        release(frame);
      }
    };
  }, []);

  return (
    <div ref={frameRef} className="page-frame">
      <div ref={contentRef} className="page-frame-content">
        {children}
      </div>
    </div>
  );
}

export default PageFrame;

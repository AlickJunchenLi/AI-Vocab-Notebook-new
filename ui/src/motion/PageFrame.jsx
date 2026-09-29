import { useEffect, useLayoutEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

// Longest a turn can hold the frame, in case the new page is exactly as tall
// as the old one and never reports a change of size.
const RELEASE_AFTER = 900;

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

    frame.style.height = `${frame.getBoundingClientRect().height}px`;
    frame.dataset.turning = String(window.setTimeout(() => release(frame), RELEASE_AFTER));
  }, [page, reduce]);

  // When the new page arrives its height differs: ease the frame towards it.
  useEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;

    if (!frame || !content || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      const height = content.offsetHeight;

      if (frame.dataset.turning && Math.abs(height - parseFloat(frame.style.height)) >= 1) {
        frame.style.height = `${height}px`;
      }
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

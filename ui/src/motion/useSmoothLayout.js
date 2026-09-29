import { useEffect } from "react";

/*
 * Smooth layout. When something inside a container changes (a row filtered
 * out, a card revealed, an error message added, a label rewritten), the
 * container eases to its new size instead of jumping, so everything after
 * it glides along; and the children named by `flip` slide from where they
 * were to where they now sit (first-last-invert-play, on transforms only).
 *
 *   useSmoothLayout(ref, { height: true, flip: ".word-row" }, key)
 *
 * Changes are noticed through the DOM: a MutationObserver sees what React
 * writes, before the browser paints it, so the old size and positions are
 * still known and nothing is ever drawn in its new place first. The sizes
 * last drawn are kept up to date by a ResizeObserver, so a change of window
 * width is followed at once rather than animated. Parts of the page that
 * change on every keystroke (the handwriting overlay) are marked
 * data-layout-ignore and never count as a change.
 *
 * Sizes are border-box sizes (every element here is border-box). While the
 * size eases, the container clips what doesn't fit yet (data-smoothing), so a
 * growing card unrolls rather than spilling over what follows it. `key`
 * re-attaches the observers when the ref moves to another element.
 */

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const RESIZE_TIME = 360;
const MOVE_TIME = 380;
const ENTER_TIME = 280;
const MUTATIONS = {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["class", "hidden"],
};

const reducedMotion = typeof window === "undefined"
  ? null
  : window.matchMedia("(prefers-reduced-motion: reduce)");

// How many containers are easing their size right now. PageFrame follows the
// page's height directly while one is, instead of easing on top of it.
let resizing = 0;

export function isSmoothingLayout() {
  return resizing > 0;
}

function ignored(record) {
  const node = record.target.nodeType === Node.ELEMENT_NODE
    ? record.target
    : record.target.parentElement;
  return Boolean(node?.closest("[data-layout-ignore]"));
}

export default function useSmoothLayout(ref, { height = false, width = false, flip = null, enter = true } = {}, key = undefined) {
  useEffect(() => {
    const element = ref.current;

    if (!element || typeof MutationObserver === "undefined") {
      return undefined;
    }

    let size = { width: element.offsetWidth, height: element.offsetHeight };
    let sizing = null;
    const moves = new Map();
    let positions = new Map();

    function tracked() {
      return flip ? Array.from(element.querySelectorAll(`:scope > :is(${flip})`)) : [];
    }

    // Where a child sits in the container's layout, ignoring any transform.
    function positionOf(child) {
      if (child.offsetParent === element) {
        return { x: child.offsetLeft, y: child.offsetTop };
      }

      return { x: child.offsetLeft - element.offsetLeft, y: child.offsetTop - element.offsetTop };
    }

    function record() {
      positions = new Map(tracked().map((child) => [child, positionOf(child)]));
    }

    // Ends the ease under way, if any, leaving the natural size in place.
    function stopSizing() {
      if (sizing) {
        const { animation, done } = sizing;
        done();
        animation.cancel();
      }
    }

    function resize(from, to) {
      const keyframes = [{}, {}];

      if (height) {
        keyframes[0].height = `${from.height}px`;
        keyframes[1].height = `${to.height}px`;
      }

      if (width) {
        keyframes[0].width = `${from.width}px`;
        keyframes[1].width = `${to.width}px`;
      }

      // A scroll container keeps its scroll position if it's hidden while it
      // eases; anything else is clipped, with a little room for focus rings.
      const overflow = window.getComputedStyle(element).overflowY;
      const animation = element.animate(keyframes, { duration: RESIZE_TIME, easing: EASE });
      // Runs once, whether the ease finishes or is stopped for another one.
      let running = true;
      const done = () => {
        if (!running) {
          return;
        }

        running = false;
        resizing -= 1;

        if (sizing?.animation === animation) {
          sizing = null;
          delete element.dataset.smoothing;
        }
      };

      sizing = { animation, done };
      resizing += 1;
      element.dataset.smoothing = overflow === "visible" ? "clip" : "hide";
      animation.addEventListener("finish", done);
      animation.addEventListener("cancel", done);
    }

    function slide(child, from, to) {
      const running = moves.get(child);
      let dx = from.x - to.x;
      let dy = from.y - to.y;

      // A child still sliding starts again from where it's drawn now.
      if (running) {
        const drawn = new DOMMatrixReadOnly(window.getComputedStyle(child).transform);
        dx += drawn.m41;
        dy += drawn.m42;
        running.cancel();
      }

      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        return;
      }

      const animation = child.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
        { duration: MOVE_TIME, easing: EASE },
      );
      moves.set(child, animation);
      const done = () => {
        if (moves.get(child) === animation) {
          moves.delete(child);
        }
      };
      animation.addEventListener("finish", done);
      animation.addEventListener("cancel", done);
    }

    function handleChange(records) {
      if (records.every(ignored)) {
        return;
      }

      if (reducedMotion?.matches) {
        stopSizing();
        size = { width: element.offsetWidth, height: element.offsetHeight };
        record();
        return;
      }

      // What is drawn now: the size last drawn, or the size part-way through
      // an ease that's still running.
      const shown = sizing
        ? { width: element.offsetWidth, height: element.offsetHeight }
        : size;
      stopSizing();
      const next = { width: element.offsetWidth, height: element.offsetHeight };

      if (flip) {
        for (const child of tracked()) {
          const before = positions.get(child);
          const after = positionOf(child);

          if (before) {
            slide(child, before, after);
          } else if (enter) {
            child.animate(
              [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
              { duration: ENTER_TIME, easing: EASE },
            );
          }
        }

        record();
      }

      const changed = (height && Math.abs(next.height - shown.height) >= 1) ||
        (width && Math.abs(next.width - shown.width) >= 1);

      if (changed) {
        resize(shown, next);
      }

      size = next;
    }

    const mutations = new MutationObserver(handleChange);
    mutations.observe(element, MUTATIONS);

    // Outside an ease, keep the drawn size and positions current, so a change
    // that didn't come through the DOM (the window narrowing) is never eased.
    const resizes = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
        if (!sizing) {
          size = { width: element.offsetWidth, height: element.offsetHeight };
          record();
        }
      });
    resizes?.observe(element);
    record();

    return () => {
      mutations.disconnect();
      resizes?.disconnect();
      stopSizing();
      for (const animation of moves.values()) {
        animation.cancel();
      }
    };
  }, [ref, height, width, flip, enter, key]);
}

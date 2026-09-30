import { useEffect } from "react";

/*
 * Smooth layout. When something inside a container changes (a row filtered
 * out, a card revealed, an error message added, a label rewritten), the
 * container eases to its new size instead of jumping, so everything after
 * it glides along; and what's inside it, the elements `flip` selects, slides
 * from where it was to where it now sits (first-last-invert-play, on
 * transforms only), so the contents move with the container rather than
 * jumping ahead of its edge.
 *
 *   useSmoothLayout(ref, { height: true, flip: ":scope > .word-row" }, key)
 *
 * `flip` is a selector run inside the container (so ":scope > *" is its
 * children, ":scope > .liquid-glass-content > *" a glass surface's). A
 * container can widen the room it leaves for shadows and decorations while it
 * clips (see data-smoothing below) with --smooth-clip-margin.
 *
 * Changes are noticed through the DOM: a MutationObserver sees what React
 * writes, before the browser paints it, so the old size and positions are
 * still known and nothing is ever drawn in its new place first. The sizes
 * last drawn are kept up to date by a ResizeObserver, so a change of window
 * width is followed at once rather than animated. Parts of the page that
 * change on every keystroke (the handwriting overlay) are marked
 * data-layout-ignore and never count as a change.
 *
 * The motion is gentle rather than snappy: it starts softly, settles slowly,
 * and takes longer the further things have to go (layoutTiming), and a
 * container and the children sliding inside it share one timing, so they
 * move as one. A child that arrives fades in just after the room for it has
 * begun to open; a child that leaves fades out where it was (a copy of it,
 * marked data-layout-ghost, since React has already removed it; only for the
 * container's own children, whose copies can sit in the same place), and the
 * others wait a moment before closing up, so nothing slides over it while
 * it's still there to see.
 *
 * Sizes are border-box sizes (every element here is border-box). While the
 * size eases, the container clips what doesn't fit yet (data-smoothing), so a
 * growing card unrolls rather than spilling over what follows it, leaving a
 * margin (--smooth-clip-margin, 12px unless the container says otherwise) so
 * shadows, focus rings and a note's tape aren't cut off meanwhile. `key`
 * re-attaches the observers when the ref moves to another element.
 */

// Soft to start, long to settle; shared with PageFrame and the page turn.
export const LAYOUT_EASE = "cubic-bezier(0.4, 0.1, 0.2, 1)";

// About a third of a second for a small shift, up to 0.72s for a long one.
export function layoutTiming(distance) {
  return {
    duration: Math.round(Math.min(720, 340 + Math.abs(distance) * 0.7)),
    easing: LAYOUT_EASE,
  };
}

// Arrivals start just after the room for them begins to open; when something
// leaves, everything else waits this long for it to fade before closing up.
const ENTER_DELAY = 70;
const LEAVE_LEAD = 90;
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

const isGhost = (node) => node.nodeType === Node.ELEMENT_NODE && node.hasAttribute("data-layout-ghost");

// Where an element sits on the page by layout alone: transforms (a dialog
// still settling, a row still sliding) don't count.
function layoutOffset(node) {
  let x = 0;
  let y = 0;

  for (let current = node; current; current = current.offsetParent) {
    x += current.offsetLeft;
    y += current.offsetTop;
  }

  return { x, y };
}

function ignored(record) {
  // A leaving child's copy coming and going is this hook's own doing.
  if (record.type === "childList") {
    const nodes = [...record.addedNodes, ...record.removedNodes];

    if (nodes.length > 0 && nodes.every(isGhost)) {
      return true;
    }
  }

  const node = record.target.nodeType === Node.ELEMENT_NODE
    ? record.target
    : record.target.parentElement;
  return Boolean(node?.closest("[data-layout-ignore], [data-layout-ghost]"));
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
    const ghosts = new Set();
    let positions = new Map();

    // Children are placed relative to the container, and a leaving child's
    // copy is laid over the container, so it needs to be positioned.
    const placed = flip && window.getComputedStyle(element).position === "static";

    if (placed) {
      element.style.position = "relative";
    }

    function tracked() {
      return flip
        ? Array.from(element.querySelectorAll(flip)).filter((node) => !node.hasAttribute("data-layout-ghost"))
        : [];
    }

    // The container's padding box, which a leaving child's copy is placed in.
    function origin() {
      const at = layoutOffset(element);
      return { x: at.x + element.clientLeft, y: at.y + element.clientTop };
    }

    // Where something inside sits in the container, ignoring any transform.
    function positionOf(node, base) {
      const at = layoutOffset(node);
      return { x: at.x - base.x, y: at.y - base.y, width: node.offsetWidth, height: node.offsetHeight };
    }

    function record() {
      const base = origin();
      positions = new Map(tracked().map((node) => [node, positionOf(node, base)]));
    }

    // Ends the ease under way, if any, leaving the natural size in place.
    function stopSizing() {
      if (sizing) {
        const { animation, done } = sizing;
        done();
        animation.cancel();
      }
    }

    function resize(from, to, timing) {
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
      const animation = element.animate(keyframes, timing);
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

    // How far a child has to travel to its new place, from where it's drawn
    // now: a child still sliding starts again from part-way.
    function offsetOf(child, from, to) {
      const running = moves.get(child);
      const offset = { x: from.x - to.x, y: from.y - to.y };

      if (running) {
        const drawn = new DOMMatrixReadOnly(window.getComputedStyle(child).transform);
        offset.x += drawn.m41;
        offset.y += drawn.m42;
        running.cancel();
      }

      return offset;
    }

    function slide(child, { x, y }, timing) {
      if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) {
        return;
      }

      const animation = child.animate(
        [{ transform: `translate(${x}px, ${y}px)` }, { transform: "translate(0, 0)" }],
        timing,
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

    // A leaving child fades out where it was, as a copy that can't be used.
    function fadeOut(child, at, timing) {
      const ghost = child.cloneNode(true);
      ghost.setAttribute("data-layout-ghost", "");
      ghost.setAttribute("aria-hidden", "true");
      ghost.inert = true;
      ghost.removeAttribute("id");
      ghost.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      Object.assign(ghost.style, {
        position: "absolute",
        top: `${at.y}px`,
        left: `${at.x}px`,
        width: `${at.width}px`,
        height: `${at.height}px`,
        margin: "0",
        pointerEvents: "none",
      });
      element.append(ghost);
      ghosts.add(ghost);

      // Quick to fade and soft at the end, so it's mostly gone before the
      // others close over its place.
      const animation = ghost.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        {
          duration: Math.round(Math.min(260, timing.duration * 0.5)),
          easing: "cubic-bezier(0.25, 0, 0.35, 1)",
          fill: "forwards",
        },
      );
      const done = () => {
        ghosts.delete(ghost);
        ghost.remove();
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
      // an ease that's still running (one that has just finished has already
      // arrived at the size last drawn).
      const shown = sizing && sizing.animation.playState !== "finished"
        ? { width: element.offsetWidth, height: element.offsetHeight }
        : size;
      stopSizing();
      const next = { width: element.offsetWidth, height: element.offsetHeight };

      const grow = {
        x: width ? next.width - shown.width : 0,
        y: height ? next.height - shown.height : 0,
      };

      // Work out every move first, so they can all share one timing.
      const slides = [];
      const arriving = [];
      const leaving = [];

      if (flip) {
        const children = tracked();
        const present = new Set(children);
        const base = origin();

        for (const child of children) {
          const before = positions.get(child);

          if (before) {
            slides.push([child, offsetOf(child, before, positionOf(child, base))]);
          } else if (enter) {
            arriving.push(child);
          }
        }

        // Only the container's own children leave a fading copy behind.
        for (const change of records) {
          if (change.target !== element) {
            continue;
          }

          for (const node of change.removedNodes) {
            const at = positions.get(node);

            if (at && !present.has(node)) {
              leaving.push([node, at]);
            }
          }
        }
      }

      const distance = Math.max(
        Math.abs(grow.x),
        Math.abs(grow.y),
        ...slides.map(([, offset]) => Math.hypot(offset.x, offset.y)),
      );
      // Everything holds its old place (fill: backwards) while a leaving
      // child fades, then moves together.
      const lead = leaving.length > 0 ? LEAVE_LEAD : 0;
      const timing = { ...layoutTiming(distance), delay: lead, fill: "backwards" };

      for (const [child, offset] of slides) {
        slide(child, offset, timing);
      }

      for (const child of arriving) {
        child.animate(
          [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }],
          { ...timing, delay: lead + ENTER_DELAY },
        );
      }

      for (const [node, at] of leaving) {
        fadeOut(node, at, timing);
      }

      if (flip) {
        record();
      }

      if (Math.abs(grow.x) >= 1 || Math.abs(grow.y) >= 1) {
        resize(shown, next, timing);
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
      for (const ghost of ghosts) {
        ghost.remove();
      }
      if (placed) {
        element.style.position = "";
      }
    };
  }, [ref, height, width, flip, enter, key]);
}

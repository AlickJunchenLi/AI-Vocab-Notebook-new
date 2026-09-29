// Distances in px: between the note and what it points at, and from the
// window's edges.
const GAP = 16;
const MARGIN = 12;
// Below this width the note docks along the bottom of the window.
const DOCK_BELOW = 560;
// The arrow stays this far from the note's corners.
const ARROW_INSET = 22;

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

/*
 * Where the tour's note goes for a target rectangle (or none), given the
 * note's size and the window's. It tries the step's preferred sides in order
 * and takes the first with room; with no room anywhere it sits at the foot of
 * the window. `arrow` is the arrow's offset along the note's edge.
 */
export function placeNote(rect, note, view, sides = ["bottom", "top", "right", "left"]) {
  if (view.width < DOCK_BELOW) {
    return { side: "dock", x: MARGIN, y: view.height - note.height - MARGIN, arrow: 0 };
  }

  if (!rect) {
    return {
      side: "none",
      x: (view.width - note.width) / 2,
      y: (view.height - note.height) / 2,
      arrow: 0,
    };
  }

  const room = {
    bottom: view.height - rect.bottom - GAP - MARGIN >= note.height,
    top: rect.top - GAP - MARGIN >= note.height,
    right: view.width - rect.right - GAP - MARGIN >= note.width,
    left: rect.left - GAP - MARGIN >= note.width,
  };
  const side = sides.find((candidate) => room[candidate]);
  const centreX = rect.left + rect.width / 2;
  const centreY = rect.top + rect.height / 2;

  if (side === "bottom" || side === "top") {
    const x = clamp(centreX - note.width / 2, MARGIN, view.width - note.width - MARGIN);
    return {
      side,
      x,
      y: side === "bottom" ? rect.bottom + GAP : rect.top - GAP - note.height,
      arrow: clamp(centreX - x, ARROW_INSET, note.width - ARROW_INSET),
    };
  }

  if (side === "right" || side === "left") {
    const y = clamp(centreY - note.height / 2, MARGIN, view.height - note.height - MARGIN);
    return {
      side,
      x: side === "right" ? rect.right + GAP : rect.left - GAP - note.width,
      y,
      arrow: clamp(centreY - y, ARROW_INSET, note.height - ARROW_INSET),
    };
  }

  return {
    side: "none",
    x: (view.width - note.width) / 2,
    y: view.height - note.height - MARGIN,
    arrow: 0,
  };
}

// The lit area around the target: a little larger than it, kept inside the
// window so a tall target's outline never runs off screen.
export function spotlightFor(rect, view) {
  if (!rect) {
    return { x: view.width / 2, y: view.height / 2, width: 0, height: 0 };
  }

  const pad = 6;
  const left = Math.max(rect.left - pad, 4);
  const top = Math.max(rect.top - pad, 4);
  const right = Math.min(rect.right + pad, view.width - 4);
  const bottom = Math.min(rect.bottom + pad, view.height - 4);
  return { x: left, y: top, width: Math.max(right - left, 0), height: Math.max(bottom - top, 0) };
}

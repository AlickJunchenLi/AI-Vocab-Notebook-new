// A short side-to-side shake, like a head saying "not yet", for a field that
// still needs filling in. It leaves no transform behind, so menus inside the
// field keep their stacking. Skipped when reduced motion is requested.
const SHAKE = [0, -6, 5, -3, 2, 0].map((x) => ({ transform: `translateX(${x}px)` }));

export function nudge(element) {
  if (
    !element?.animate ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  element.animate(SHAKE, { duration: 360, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
}

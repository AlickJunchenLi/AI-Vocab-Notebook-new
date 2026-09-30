// The opening plays each time the notebook is loaded, unless the reader has
// asked for less motion.
export function shouldOpenNotebook() {
  try {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

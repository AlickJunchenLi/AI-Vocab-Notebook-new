/*
 * A theme change fades through a neutral pearl: saturation dips almost to
 * grey, the hue turns while there is next to no colour to see, then the new
 * theme's colour comes back. Turning the hue at full saturation would sweep
 * through unrelated colours (pink to green passes red).
 *
 * Each theme's values stay in index.css. The fade overrides them inline on
 * <html> and removes the overrides at the end, when the [data-theme] rule
 * already holds the same values.
 */
const DURATION = 800;
// Saturation at the bottom of the dip; a trace of colour keeps it pearly.
const PEARL = 0.06;
const PROPERTIES = ["--theme-hue", "--theme-hue-2", "--theme-chroma", "--theme-saturation"];

let fade = null;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const mix = (from, to, t) => from + (to - from) * t;
const phase = (t, start, end) => easeInOut(Math.min(1, Math.max(0, (t - start) / (end - start))));
// The shorter way round the hue circle.
const hueDelta = (from, to) => ((((to - from) % 360) + 540) % 360) - 180;

function readTheme(root) {
  const style = getComputedStyle(root);
  return {
    hue: parseFloat(style.getPropertyValue("--theme-hue")),
    hue2: parseFloat(style.getPropertyValue("--theme-hue-2")),
    chroma: parseFloat(style.getPropertyValue("--theme-chroma")),
    saturation: 1,
  };
}

function stateAt(t, from, to) {
  // The hue turns only while saturation is near the bottom of the dip.
  const turn = phase(t, 0.35, 0.65);
  return {
    hue: from.hue + hueDelta(from.hue, to.hue) * turn,
    hue2: from.hue2 + hueDelta(from.hue2, to.hue2) * turn,
    chroma: mix(from.chroma, to.chroma, turn),
    saturation: t < 0.5
      ? mix(from.saturation, PEARL, phase(t, 0, 0.4))
      : mix(PEARL, 1, phase(t, 0.6, 1)),
  };
}

function write(root, state) {
  root.style.setProperty("--theme-hue", state.hue.toFixed(2));
  root.style.setProperty("--theme-hue-2", state.hue2.toFixed(2));
  root.style.setProperty("--theme-chroma", (state.chroma * state.saturation).toFixed(4));
  root.style.setProperty("--theme-saturation", state.saturation.toFixed(4));
}

function stopFade(root) {
  if (!fade) return;
  cancelAnimationFrame(fade.frame);
  fade = null;
  for (const name of PROPERTIES) root.style.removeProperty(name);
}

// Apply the stylesheet's values with transitions still off, then allow them.
function settle(root) {
  void root.offsetWidth;
  root.classList.remove("theme-switching");
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (root.dataset.theme === theme) return;
  // The first theme of a visit, and every change under reduced motion, is
  // applied at once.
  const animate = root.dataset.theme !== undefined &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // A change made mid-fade carries on from the colours on screen.
  const from = animate ? (fade?.state ?? readTheme(root)) : null;
  stopFade(root);
  root.classList.add("theme-switching");
  root.dataset.theme = theme;
  if (!animate) {
    settle(root);
    return;
  }

  const to = readTheme(root);
  // Back to the old colours before anything is painted.
  write(root, from);
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / DURATION);
    if (t === 1) {
      stopFade(root);
      settle(root);
      return;
    }
    fade.state = stateAt(t, from, to);
    write(root, fade.state);
    fade.frame = requestAnimationFrame(step);
  };
  fade = { state: from, frame: requestAnimationFrame(step) };
}

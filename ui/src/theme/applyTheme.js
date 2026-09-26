/*
 * A theme change fades through a neutral pearl: saturation dips almost to
 * grey, the ink's and the paper's hues turn while there is next to no colour
 * to see, then the new theme's colours come back. Turning a hue at full
 * saturation would sweep through unrelated colours (pink to green passes red).
 *
 * Each theme's values stay in index.css. The fade overrides them inline on
 * <html> and removes the overrides at the end, when the [data-theme] rule
 * already holds the same values.
 */
const DURATION = 800;
// Saturation at the bottom of the dip; a trace of colour keeps it pearly.
const PEARL = 0.06;
const PROPERTIES = [
  "--theme-hue",
  "--theme-hue-2",
  "--theme-chroma",
  "--theme-saturation",
  "--paper-hue",
  "--paper-chroma",
];

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
    paperHue: parseFloat(style.getPropertyValue("--paper-hue")),
    paperChroma: parseFloat(style.getPropertyValue("--paper-chroma")),
    saturation: 1,
  };
}

function stateAt(t, from, to) {
  // The hues turn only while saturation is near the bottom of the dip.
  const turn = phase(t, 0.35, 0.65);
  return {
    hue: from.hue + hueDelta(from.hue, to.hue) * turn,
    hue2: from.hue2 + hueDelta(from.hue2, to.hue2) * turn,
    chroma: mix(from.chroma, to.chroma, turn),
    paperHue: from.paperHue + hueDelta(from.paperHue, to.paperHue) * turn,
    paperChroma: mix(from.paperChroma, to.paperChroma, turn),
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
  root.style.setProperty("--paper-hue", state.paperHue.toFixed(2));
  root.style.setProperty("--paper-chroma", state.paperChroma.toFixed(4));
}

let scratch = null;

/*
 * The browser's own bars (the mobile address bar, for one) take the desk
 * colour. <meta name="theme-color"> wants a plain colour, so the desk's
 * oklch() is resolved on a probe and read back from a one-pixel canvas.
 */
export function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta || !document.body) return;
  const probe = document.createElement("span");
  probe.hidden = true;
  probe.style.color = "var(--canvas)";
  document.body.append(probe);
  const colour = getComputedStyle(probe).color;
  probe.remove();
  scratch ??= Object.assign(document.createElement("canvas"), { width: 1, height: 1 })
    .getContext("2d", { willReadFrequently: true });
  if (!scratch) return;
  scratch.clearRect(0, 0, 1, 1);
  scratch.fillStyle = colour;
  scratch.fillRect(0, 0, 1, 1);
  const [r, g, b] = scratch.getImageData(0, 0, 1, 1).data;
  meta.setAttribute("content", `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`);
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
  syncThemeColor();
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

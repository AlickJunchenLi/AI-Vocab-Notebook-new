/*
 * The shader needs plain RGB, but the theme lives in oklch() with calc() and
 * custom properties. The browser resolves those on a probe element, and a
 * 1x1 canvas turns whatever colour syntax it returns into RGB.
 */
// A touch of the theme's hue, like the CSS rim light, so a highlight still
// reads against pale glass.
const LIGHT = "oklch(97% calc(0.05 * var(--theme-chroma)) var(--theme-hue))";
const SHADE = "oklch(41.9% calc(0.087 * var(--theme-chroma)) calc(var(--theme-hue) - 11.2))";

let scratch = null;

function toRgb(colour, fallback) {
  scratch ??= Object.assign(document.createElement("canvas"), { width: 1, height: 1 })
    .getContext("2d", { willReadFrequently: true });
  if (!scratch) return fallback;
  scratch.clearRect(0, 0, 1, 1);
  scratch.fillStyle = "#010203";
  scratch.fillStyle = colour;
  scratch.fillRect(0, 0, 1, 1);
  const [r, g, b] = scratch.getImageData(0, 0, 1, 1).data;
  // The sentinel survives only if the canvas rejected the colour syntax.
  if (r === 1 && g === 2 && b === 3) return fallback;
  return [r / 255, g / 255, b / 255];
}

export function readLiquidColours(element) {
  const probe = document.createElement("span");
  probe.hidden = true;
  element.append(probe);
  probe.style.color = LIGHT;
  const light = getComputedStyle(probe).color;
  probe.style.color = SHADE;
  const shade = getComputedStyle(probe).color;
  probe.remove();
  return {
    light: toRgb(light, [1, 1, 1]),
    shade: toRgb(shade, [0.2, 0.18, 0.3]),
  };
}

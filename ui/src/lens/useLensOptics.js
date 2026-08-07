import { useRef } from "react";
import { lerp, saturate } from "../glass/roundedRectField.js";

/*
 * Steps 4 and 5 - colour infusion and responsive lensing.
 *
 * Runs inside the motion loop, after the spring has integrated, and does two
 * things React cannot do per frame without re-rendering:
 *
 *   colour infusion - reads the backdrop under the lens and feeds a smoothed
 *                     average back into the tint and rim as CSS variables, so
 *                     the glass takes on the colour of what it is over.
 *
 *   responsive lensing - rewrites the feDisplacementMap `scale` attribute from
 *                     the interaction state. Refraction is not a fixed
 *                     property of the element: it deepens on hover, on press,
 *                     and with speed, which is what makes the lens read as a
 *                     physical object rather than a decal.
 */

const TINT_LERP = 0.09;
const SCALE_EPSILON = 0.05;

function writeVariable(cache, element, name, value) {
  if (cache.get(name) === value) {
    return;
  }

  cache.set(name, value);
  element.style.setProperty(name, value);
}

export function useLensOptics({ lensRef, fieldRef, filterId, size, settings }) {
  const tintRef = useRef({ r: 130, g: 150, b: 230 });
  const nodesRef = useRef(null);
  const variableCacheRef = useRef(new Map());
  const scaleCacheRef = useRef([]);

  /*
   * Scales are recomputed from props rather than read back from the DOM: React
   * rewrites the attribute whenever the controls change, so anything cached
   * from the attribute would go stale on the next render.
   */
  function getTargetScales() {
    const base = settings.strength * 2;

    return settings.dispersion > 0
      ? [
          base * (1 - settings.dispersion),
          base,
          base * (1 + settings.dispersion),
        ]
      : [base];
  }

  function getDisplacementNodes(expectedCount) {
    const cached = nodesRef.current;

    if (
      cached &&
      cached.length === expectedCount &&
      cached[0]?.isConnected
    ) {
      return cached;
    }

    const filter = document.getElementById(filterId);

    if (!filter) {
      return null;
    }

    const nodes = [...filter.querySelectorAll("feDisplacementMap")];
    nodesRef.current = nodes.length === expectedCount ? nodes : null;

    return nodesRef.current;
  }

  return function handleFrame(state) {
    const lens = lensRef.current;

    if (!lens) {
      return;
    }

    const cache = variableCacheRef.current;
    const centreX = state.x + size * 0.5;
    const centreY = state.y + size * 0.5;

    /* --- colour infusion ------------------------------------------------ */

    const sampled = fieldRef.current?.sample(centreX, centreY, size * 0.34);

    if (sampled) {
      const tint = tintRef.current;
      tint.r = lerp(tint.r, sampled.r, TINT_LERP);
      tint.g = lerp(tint.g, sampled.g, TINT_LERP);
      tint.b = lerp(tint.b, sampled.b, TINT_LERP);

      writeVariable(cache, lens, "--lens-tint-r", Math.round(tint.r));
      writeVariable(cache, lens, "--lens-tint-g", Math.round(tint.g));
      writeVariable(cache, lens, "--lens-tint-b", Math.round(tint.b));

      // Luminance decides whether the rim reads as a bright or dark bevel.
      const luminance = saturate(
        (0.2126 * tint.r + 0.7152 * tint.g + 0.0722 * tint.b) / 255,
      );
      writeVariable(cache, lens, "--lens-luma", luminance.toFixed(3));
    }

    /* --- light direction ------------------------------------------------ */

    /*
     * The highlight lags the motion: the light stays put in the world while
     * the lens moves under it, so the specular slides against the heading.
     */
    const lightX = 50 - state.headingX * state.speed * 26;
    const lightY = 34 - state.headingY * state.speed * 26;

    writeVariable(cache, lens, "--lens-light-x", `${lightX.toFixed(2)}%`);
    writeVariable(cache, lens, "--lens-light-y", `${lightY.toFixed(2)}%`);

    /* --- responsive lensing --------------------------------------------- */

    const targetScales = getTargetScales();
    const nodes = getDisplacementNodes(targetScales.length);

    if (!nodes) {
      scaleCacheRef.current = [];
      return;
    }

    const boost =
      1 + state.hover * 0.22 + state.press * 0.14 + state.speed * 0.42;
    const scaleCache = scaleCacheRef.current;

    for (const [index, node] of nodes.entries()) {
      const value = targetScales[index] * boost;

      if (Math.abs((scaleCache[index] ?? Number.NaN) - value) < SCALE_EPSILON) {
        continue;
      }

      scaleCache[index] = value;
      node.setAttribute("scale", value.toFixed(2));
    }
  };
}

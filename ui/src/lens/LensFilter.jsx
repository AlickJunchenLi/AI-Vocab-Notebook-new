import { useMemo } from "react";
import { createDisplacementMap } from "./displacementMap.js";
import "./lensFilter.css";

/*
 * The SVG filter referenced by `backdrop-filter: url(#id)`.
 *
 * Units are userSpaceOnUse throughout so `scale` is honest pixels and the
 * region can be inflated by `pad` around the element box - the displacement
 * samples outward, so it needs backdrop beyond the rim to read from.
 *
 * Chromatic dispersion, when enabled, is three passes of the same map at
 * slightly different scales, keeping one colour channel from each. That is the
 * wavelength-dependent index of refraction: red bends least, blue most. The
 * channels are recombined additively; alpha saturates to 1, which is correct
 * here because a backdrop is opaque.
 */

/*
 * Each matrix keeps one colour channel and forces alpha to 1.
 *
 * The alpha row matters more than it looks. feComposite works on premultiplied
 * colour, so summing three images that each carry the backdrop's own alpha
 * multiplies the colour in but sums the alpha to saturation: over a backdrop
 * that is not fully opaque, white comes out as mid grey. Forcing alpha to 1
 * here makes the sum a pure colour operation, and the original alpha is put
 * back at the end with a single feComposite operator="in".
 */
const CHANNEL_MATRICES = {
  r: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1",
  g: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 0 1",
  b: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 0 1",
};

function LensFilter({
  id,
  width,
  height,
  radius,
  edge,
  bulge,
  strength,
  dispersion,
  pad,
}) {
  const map = useMemo(
    () => createDisplacementMap({ width, height, radius, edge, bulge, pad }),
    [width, height, radius, edge, bulge, pad],
  );

  const regionX = -pad;
  const regionY = -pad;
  const regionWidth = width + pad * 2;
  const regionHeight = height + pad * 2;

  /*
   * The map encodes a unit normal times a 0..1 profile, and feDisplacementMap
   * multiplies (channel - 0.5), whose peak is 127/255 ~ 0.498. Doubling the
   * scale makes `strength` mean "maximum pixels of bend at the rim".
   */
  const scale = strength * 2;

  return (
    <svg className="lens-filter-defs" aria-hidden="true" focusable="false">
      <defs>
        <filter
          id={id}
          filterUnits="userSpaceOnUse"
          primitiveUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
          x={regionX}
          y={regionY}
          width={regionWidth}
          height={regionHeight}
        >
          <feImage
            href={map}
            x={regionX}
            y={regionY}
            width={regionWidth}
            height={regionHeight}
            preserveAspectRatio="none"
            result="map"
          />

          {dispersion > 0 ? (
            <>
              <feDisplacementMap
                in="SourceGraphic"
                in2="map"
                scale={scale * (1 - dispersion)}
                xChannelSelector="R"
                yChannelSelector="G"
                result="passRed"
              />
              <feColorMatrix
                in="passRed"
                type="matrix"
                values={CHANNEL_MATRICES.r}
                result="channelRed"
              />

              <feDisplacementMap
                in="SourceGraphic"
                in2="map"
                scale={scale}
                xChannelSelector="R"
                yChannelSelector="G"
                result="passGreen"
              />
              <feColorMatrix
                in="passGreen"
                type="matrix"
                values={CHANNEL_MATRICES.g}
                result="channelGreen"
              />

              <feDisplacementMap
                in="SourceGraphic"
                in2="map"
                scale={scale * (1 + dispersion)}
                xChannelSelector="R"
                yChannelSelector="G"
                result="passBlue"
              />
              <feColorMatrix
                in="passBlue"
                type="matrix"
                values={CHANNEL_MATRICES.b}
                result="channelBlue"
              />

              <feComposite
                in="channelRed"
                in2="channelGreen"
                operator="arithmetic"
                k2="1"
                k3="1"
                result="redGreen"
              />
              <feComposite
                in="redGreen"
                in2="channelBlue"
                operator="arithmetic"
                k2="1"
                k3="1"
                result="dispersed"
              />
              {/* Restore the backdrop's own alpha, taken from the middle pass. */}
              <feComposite in="dispersed" in2="passGreen" operator="in" />
            </>
          ) : (
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={scale}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          )}
        </filter>
      </defs>
    </svg>
  );
}

export default LensFilter;

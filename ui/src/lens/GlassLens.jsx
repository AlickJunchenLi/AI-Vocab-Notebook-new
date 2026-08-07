import LensFilter from "./LensFilter.jsx";
import { SUPPORTS_BACKDROP_DISPLACEMENT } from "./lensSupport.js";

/*
 * The lens itself. Every layer is a separate element so each optical term maps
 * to exactly one paint:
 *
 *   refraction - backdrop blur + displacement (steps 2 and 3)
 *   tint       - colour infusion sampled from the backdrop (step 4)
 *   specular   - moving edge highlight (step 4)
 *   rim        - fresnel border and depth (step 4)
 *
 * Position, squash and interaction weights arrive as CSS custom properties
 * written by useLensMotion, so this component never re-renders while moving.
 */

function GlassLens({
  ref,
  filterId,
  width,
  height,
  radius,
  edge,
  bulge,
  strength,
  dispersion,
  blur,
  saturation = 1.5,
  label,
}) {
  // The filter samples outward, so its region needs backdrop beyond the rim.
  const pad = Math.ceil(strength * 2 + 24);
  const backdropFilter = SUPPORTS_BACKDROP_DISPLACEMENT
    ? `blur(${blur}px) url(#${filterId}) saturate(${saturation})`
    : `blur(${blur}px) saturate(${saturation})`;

  return (
    <>
      {SUPPORTS_BACKDROP_DISPLACEMENT ? (
        <LensFilter
          id={filterId}
          width={width}
          height={height}
          radius={radius}
          edge={edge}
          bulge={bulge}
          strength={strength}
          dispersion={dispersion}
          pad={pad}
        />
      ) : null}

      <div
        ref={ref}
        className="glass-lens"
        style={{
          "--lens-width": `${width}px`,
          "--lens-height": `${height}px`,
          "--lens-radius": `${radius}px`,
        }}
      >
        <div
          className="glass-lens-refraction"
          aria-hidden="true"
          style={{ backdropFilter, WebkitBackdropFilter: backdropFilter }}
        />
        <div className="glass-lens-tint" aria-hidden="true" />
        <div className="glass-lens-specular" aria-hidden="true" />
        <div className="glass-lens-rim" aria-hidden="true" />
        {label ? <span className="glass-lens-label">{label}</span> : null}
      </div>
    </>
  );
}

export default GlassLens;

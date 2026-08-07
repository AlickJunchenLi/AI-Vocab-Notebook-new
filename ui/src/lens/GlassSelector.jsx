import { useId, useRef } from "react";
import LensFilter from "./LensFilter.jsx";
import { SUPPORTS_BACKDROP_DISPLACEMENT } from "./lensSupport.js";
import { useSelectorTracking } from "./useSelectorTracking.js";
import "./glassSelector.css";

/*
 * A movable glass selector for a list.
 *
 * Drop it inside a positioned container whose rows carry the key attribute; it
 * finds the hovered or selected row, springs onto it, and refracts whatever is
 * underneath. It never takes pointer events, so the rows below stay clickable.
 *
 * Optics are the same stack as the standalone lens: backdrop blur, an SDF
 * displacement pass strongest at the rim, a specular highlight that slides with
 * the motion, and a fresnel rim.
 */

function GlassSelector({
  containerRef,
  activeKey,
  keyAttribute = "data-glass-row",
  radius = 18,
  edge = 26,
  bulge = 2.6,
  strength = 16,
  dispersion = 0.1,
  blur = 3,
  saturation = 1.28,
}) {
  const selectorRef = useRef(null);
  const filterId = `glass-selector-${useId().replace(/:/g, "")}`;
  const { width, height } = useSelectorTracking({
    containerRef,
    selectorRef,
    activeKey,
    keyAttribute,
  });

  const hasBox = width > 0 && height > 0;
  const useDisplacement = SUPPORTS_BACKDROP_DISPLACEMENT && hasBox;
  const pad = Math.ceil(strength * 2 + 24);
  const backdropFilter = useDisplacement
    ? `blur(${blur}px) url(#${filterId}) saturate(${saturation})`
    : `blur(${blur}px) saturate(${saturation})`;

  return (
    <>
      {useDisplacement ? (
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
        ref={selectorRef}
        className="glass-selector"
        aria-hidden="true"
        style={{
          "--sel-width": `${width}px`,
          "--sel-height": `${height}px`,
          "--sel-radius": `${radius}px`,
        }}
      >
        <div
          className="glass-selector-refraction"
          style={{ backdropFilter, WebkitBackdropFilter: backdropFilter }}
        />
        <div className="glass-selector-specular" />
        <div className="glass-selector-rim" />
      </div>
    </>
  );
}

export default GlassSelector;

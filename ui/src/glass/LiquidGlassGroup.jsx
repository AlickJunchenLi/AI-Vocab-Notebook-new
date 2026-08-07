import { useCallback, useMemo, useRef } from "react";
import { LiquidGlassContext } from "./LiquidGlassContext.js";

function normalizeSurfaceConfig(config) {
  return {
    element: config.element,
    radius: config.radius ?? 28,
    intensity: config.intensity ?? 1,
    variant: config.variant ?? "card",
    interactive: config.interactive ?? true,
    render: null,
    rect: null,
    prevD: null,
    prevAbsD: Infinity,
    lastCrossAt: 0,
  };
}

function getClassName(className) {
  return ["liquid-glass-group", className].filter(Boolean).join(" ");
}

/*
 * The cursor-driven pass is currently unwired, pending a redesign.
 *
 * What is gone: the full-viewport canvas (LiquidGlassFieldOverlay) and the
 * pointer loop that painted it (useLiquidGlassPointer). Both files are still in
 * this folder — nothing calls them. Surfaces now render as static frosted
 * glass; see liquidGlass.css.
 *
 * What survives on purpose: the surface registry below. Every LiquidGlassSurface
 * still reports its element, radius, intensity and variant here, so a new effect
 * can read the live set of surfaces without re-plumbing the tree.
 *
 * The overscan / spillRadius / maxActiveSurfaces props are gone with the loop
 * they tuned. Their defaults are still in LIQUID_GLASS_CONSTANTS
 * (roundedRectField.js) if the replacement wants a starting point.
 */

function LiquidGlassGroup({ children, className = "", ...props }) {
  const groupRef = useRef(null);
  const surfacesRef = useRef(new Map());
  const resizeObserverRef = useRef(null);
  const markMeasurementsDirtyRef = useRef(() => {});

  const registerSurface = useCallback((id, config) => {
    const surface = {
      id,
      ...normalizeSurfaceConfig(config),
    };

    surfacesRef.current.set(id, surface);
    resizeObserverRef.current?.observe(surface.element);
    markMeasurementsDirtyRef.current();

    return () => {
      resizeObserverRef.current?.unobserve(surface.element);
      surfacesRef.current.delete(id);
      markMeasurementsDirtyRef.current();
    };
  }, []);

  const updateSurface = useCallback((id, config) => {
    const surface = surfacesRef.current.get(id);

    if (!surface) {
      return;
    }

    surface.radius = config.radius ?? surface.radius;
    surface.intensity = config.intensity ?? surface.intensity;
    surface.variant = config.variant ?? surface.variant;
    surface.interactive = config.interactive ?? surface.interactive;
    markMeasurementsDirtyRef.current();
  }, []);

  const contextValue = useMemo(
    () => ({
      registerSurface,
      updateSurface,
    }),
    [registerSurface, updateSurface]
  );

  return (
    <LiquidGlassContext.Provider value={contextValue}>
      <div ref={groupRef} className={getClassName(className)} {...props}>
        {children}
      </div>
    </LiquidGlassContext.Provider>
  );
}

export default LiquidGlassGroup;

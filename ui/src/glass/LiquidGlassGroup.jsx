import { useCallback, useMemo, useRef } from "react";
import LiquidGlassFieldOverlay from "./LiquidGlassFieldOverlay.jsx";
import { LiquidGlassContext } from "./LiquidGlassContext.js";
import { useLiquidGlassPointer } from "./useLiquidGlassPointer.js";
import { LIQUID_GLASS_CONSTANTS } from "./roundedRectField.js";

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

function LiquidGlassGroup({
  children,
  className = "",
  overscan = LIQUID_GLASS_CONSTANTS.GROUP_OVERSCAN,
  spillRadius = LIQUID_GLASS_CONSTANTS.SPILL_RADIUS,
  maxActiveSurfaces = LIQUID_GLASS_CONSTANTS.MAX_ACTIVE_SURFACES,
  ...props
}) {
  const groupRef = useRef(null);
  const overlayRef = useRef(null);
  const surfacesRef = useRef(new Map());
  const resizeObserverRef = useRef(null);
  const markMeasurementsDirtyRef = useRef(() => {});

  useLiquidGlassPointer({
    groupRef,
    overlayRef,
    surfacesRef,
    resizeObserverRef,
    markMeasurementsDirtyRef,
    overscan,
    spillRadius,
    maxActiveSurfaces,
  });

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
        <LiquidGlassFieldOverlay canvasRef={overlayRef} />
        {children}
      </div>
    </LiquidGlassContext.Provider>
  );
}

export default LiquidGlassGroup;

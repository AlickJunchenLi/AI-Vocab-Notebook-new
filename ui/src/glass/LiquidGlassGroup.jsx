import { useCallback, useMemo, useRef } from "react";
import { LiquidGlassContext } from "./LiquidGlassContext.js";
import { useLiquidGlassPointer } from "./useLiquidGlassPointer.js";

function normalizeSurfaceConfig(config) {
  return {
    element: config.element,
    radius: config.radius ?? 28,
    intensity: config.intensity ?? 1,
    variant: config.variant ?? "card",
    interactive: config.interactive ?? true,
    render: null,
    rect: null,
  };
}

function getClassName(className) {
  return ["liquid-glass-group", className].filter(Boolean).join(" ");
}

function LiquidGlassGroup({
  children,
  className = "",
  enabled = true,
  spillRadius = 220,
  maxActiveSurfaces = 6,
  ...props
}) {
  const groupRef = useRef(null);
  const surfacesRef = useRef(new Map());
  const resizeObserverRef = useRef(null);
  const markMeasurementsDirtyRef = useRef(() => {});

  useLiquidGlassPointer({
    groupRef,
    surfacesRef,
    resizeObserverRef,
    markMeasurementsDirtyRef,
    enabled,
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
        {children}
      </div>
    </LiquidGlassContext.Provider>
  );
}

export default LiquidGlassGroup;

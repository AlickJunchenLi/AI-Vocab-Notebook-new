import { useCallback, useEffect, useId, useRef } from "react";
import { useLiquidGlassGroup } from "./LiquidGlassContext.js";

const VALID_VARIANTS = new Set(["card", "panel", "button", "menu", "sidebar"]);

function getVariant(variant) {
  return VALID_VARIANTS.has(variant) ? variant : "card";
}

function getClassName(className, variant) {
  const resolvedVariant = getVariant(variant);

  return [
    "liquid-glass-surface",
    `liquid-glass-${resolvedVariant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

function LiquidGlassSurface({
  ref: forwardedRef,
  as: Element = "div",
  id,
  children,
  className = "",
  variant = "card",
  radius = 28,
  intensity = 1,
  interactive = true,
  style,
  ...props
}) {
  const generatedId = useId();
  const surfaceId = id ?? generatedId;
  const surfaceRef = useRef(null);
  const group = useLiquidGlassGroup();
  const Content = Element === "button" || Element === "a" ? "span" : "div";
  const resolvedVariant = getVariant(variant);
  const setSurfaceRef = useCallback(
    (element) => {
      surfaceRef.current = element;

      if (typeof forwardedRef === "function") {
        forwardedRef(element);
      } else if (forwardedRef) {
        forwardedRef.current = element;
      }
    },
    [forwardedRef],
  );

  useEffect(() => {
    const element = surfaceRef.current;

    if (!element || !group) {
      return undefined;
    }

    return group.registerSurface(surfaceId, {
      element,
      radius,
      intensity,
      variant: resolvedVariant,
      interactive,
    });
  }, [group, surfaceId, radius, intensity, resolvedVariant, interactive]);

  useEffect(() => {
    group?.updateSurface(surfaceId, {
      radius,
      intensity,
      variant: resolvedVariant,
      interactive,
    });
  }, [group, surfaceId, radius, intensity, resolvedVariant, interactive]);

  return (
    <Element
      ref={setSurfaceRef}
      id={id}
      className={getClassName(className, resolvedVariant)}
      data-liquid-glass-id={surfaceId}
      data-liquid-glass-variant={resolvedVariant}
      style={{
        "--lg-radius": `${radius}px`,
        "--lg-intensity": intensity,
        ...style,
      }}
      {...props}
    >
      <Content className="liquid-glass-content">{children}</Content>
    </Element>
  );
}

export default LiquidGlassSurface;

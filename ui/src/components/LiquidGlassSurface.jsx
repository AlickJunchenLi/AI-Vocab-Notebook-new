import { useLiquidGlassPointer } from "../hooks/useLiquidGlassPointer";

const VALID_VARIANTS = new Set(["card", "button", "panel", "menu"]);

function getClassName(className, variant) {
  const resolvedVariant = VALID_VARIANTS.has(variant) ? variant : "card";

  return [
    "liquid-glass-surface",
    `liquid-glass-${resolvedVariant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

function LiquidGlassSurface({
  as: Element = "div",
  children,
  className = "",
  variant = "card",
  radius = 28,
  intensity = 1,
  style,
  ...props
}) {
  const surfaceRef = useLiquidGlassPointer({ radius, intensity });
  const contentElement = Element === "button" || Element === "a" ? "span" : "div";
  const Content = contentElement;

  return (
    <Element
      ref={surfaceRef}
      className={getClassName(className, variant)}
      style={{
        "--glass-radius": `${radius}px`,
        "--glass-intensity": intensity,
        ...style,
      }}
      {...props}
    >
      <Content className="liquid-glass-content">{children}</Content>
    </Element>
  );
}

export default LiquidGlassSurface;

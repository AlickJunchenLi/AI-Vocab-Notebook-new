import { createPortal } from "react-dom";

function LiquidGlassFieldOverlay({ overlayRef }) {
  // Keep viewport coordinates even inside a transformed or scrolling app shell.
  return createPortal(
    <div ref={overlayRef} className="liquid-glass-field-overlay" aria-hidden="true">
      <span className="liquid-glass-cursor-aura" />
      <span className="liquid-glass-cursor-lens">
        <span className="liquid-glass-cursor-rim" />
      </span>
    </div>,
    document.body,
  );
}

export default LiquidGlassFieldOverlay;

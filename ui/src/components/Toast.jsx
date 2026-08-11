import { useEffect } from "react";
import Icon from "./Icon.jsx";
import LiquidGlassSurface from "../glass/LiquidGlassSurface.jsx";

function Toast({ message, actionLabel, onAction, onDismiss, duration = 5000 }) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timeout);
  }, [duration, onDismiss]);

  return (
    <LiquidGlassSurface
      as="aside"
      id="app-toast"
      className="app-toast"
      variant="menu"
      radius={18}
      intensity={0.94}
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="app-toast-icon" aria-hidden="true">
        <Icon name="check" size={17} />
      </span>
      <span className="app-toast-message">{message}</span>
      {actionLabel && onAction ? (
        <button type="button" className="app-toast-action" onClick={onAction}>
          <Icon name="rotate-ccw" size={16} />
          {actionLabel}
        </button>
      ) : null}
      <button
        type="button"
        className="app-toast-dismiss"
        aria-label="Dismiss notification"
        onClick={onDismiss}
      >
        <Icon name="plus" size={16} />
      </button>
    </LiquidGlassSurface>
  );
}

export default Toast;

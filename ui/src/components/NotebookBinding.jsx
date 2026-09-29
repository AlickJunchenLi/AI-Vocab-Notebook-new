import { useEffect, useRef, useState } from "react";

/*
 * The rings of the spiral binding. Like a real notebook's they keep a fixed
 * pitch (--ring-pitch in App.css), so a longer page simply has more of them
 * and moving between pages never slides the rings that are already there.
 * The count follows the binding's height; a ResizeObserver reports it once
 * when observation starts and again whenever the notebook grows or shrinks.
 */
function NotebookBinding() {
  const bindingRef = useRef(null);
  const [count, setCount] = useState(8);

  useEffect(() => {
    const binding = bindingRef.current;

    if (!binding || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      const style = window.getComputedStyle(binding);
      const pitch = parseFloat(style.getPropertyValue("--ring-pitch")) || 84;
      const ring = parseFloat(style.getPropertyValue("--ring-height")) || 10;
      setCount(Math.max(2, Math.floor((binding.clientHeight - ring) / pitch) + 1));
    });

    observer.observe(binding);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={bindingRef} className="notebook-binding" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <i key={index} />)}
    </div>
  );
}

export default NotebookBinding;

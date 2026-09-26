import { useEffect } from "react";

/*
 * The notebook arrives closed: its cover, with the title on a paper label,
 * rests on the page for a moment and then fades away to show today's page.
 * The fade is CSS (App.css); this component lays out the cover and removes
 * it when the fade ends. Any key, click, scroll or touch skips straight to
 * the open page.
 */
function NotebookOpening({ words, languages, onDone }) {
  useEffect(() => {
    const skip = () => onDone();
    window.addEventListener("keydown", skip);
    window.addEventListener("wheel", skip, { passive: true });
    window.addEventListener("touchstart", skip, { passive: true });
    return () => {
      window.removeEventListener("keydown", skip);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchstart", skip);
    };
  }, [onDone]);

  const summary = words === 0
    ? "No words yet"
    : `${words} ${words === 1 ? "word" : "words"} in ${languages} ${languages === 1 ? "language" : "languages"}`;

  return (
    <div
      className="notebook-opening"
      aria-hidden="true"
      onPointerDown={onDone}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) onDone();
      }}
    >
      <div className="opening-label">
        <strong>Vocabulary</strong>
        <span>{summary}</span>
      </div>
    </div>
  );
}

export default NotebookOpening;

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { THEMES } from "../theme/themes.js";

const NAV_ITEMS = [
  { id: "today", label: "Today", icon: "sun" },
  { id: "library", label: "Library", icon: "book-open" },
  { id: "practice", label: "Practice", icon: "target" },
  { id: "progress", label: "Progress", icon: "chart" },
];

function TopMenu({
  activePage,
  onNavigate,
  onAdd,
  ruledPaper,
  onToggleRuling,
  darkPaper,
  onTogglePaperTone,
  theme,
  onThemeChange,
}) {
  // On small screens the ink pens fold into a compact tray.
  const [isThemeTrayOpen, setIsThemeTrayOpen] = useState(false);
  const themeWrapRef = useRef(null);
  const themeToggleRef = useRef(null);
  const pickedWithPointerRef = useRef(false);
  const currentTheme = THEMES.find((option) => option.id === theme) ?? THEMES[0];

  useEffect(() => {
    if (!isThemeTrayOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!themeWrapRef.current?.contains(event.target)) {
        setIsThemeTrayOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsThemeTrayOpen(false);
        themeToggleRef.current?.focus();
      }
    }

    themeWrapRef.current?.querySelector("input:checked")?.focus({ preventScroll: true });
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isThemeTrayOpen]);

  function handleThemeClick(event) {
    // A click picks and closes, even on the current theme; arrow keys keep the
    // tray open while browsing.
    if (isThemeTrayOpen && pickedWithPointerRef.current && event.target instanceof HTMLInputElement) {
      setIsThemeTrayOpen(false);
      themeToggleRef.current?.focus({ preventScroll: true });
    }
  }

  return (
    <header
      id="top-menu"
      className="top-menu"
    >
      <button
        type="button"
        className="brand"
        onClick={() => onNavigate("today")}
        aria-label="Go to today"
      >
        <span className="brand-mark" aria-hidden="true">
          <Icon name="book-open" size={24} />
        </span>
        <span className="brand-name">Vocabulary<span className="brand-caption">your personal notebook</span></span>
      </button>

      <nav className="primary-nav" aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={activePage === item.id ? "nav-item active" : "nav-item"}
            aria-label={item.label}
            aria-current={activePage === item.id ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <Icon name={item.icon} size={19} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="header-actions">
        <div
          ref={themeWrapRef}
          className={isThemeTrayOpen ? "theme-picker-wrap open" : "theme-picker-wrap"}
        >
          <button
            ref={themeToggleRef}
            type="button"
            className="theme-picker-toggle"
            aria-expanded={isThemeTrayOpen}
            aria-controls="theme-picker"
            aria-label={`Ink colour: ${currentTheme.label}`}
            title="Choose your ink"
            onClick={() => setIsThemeTrayOpen((open) => !open)}
          >
            <span className="theme-swatch" data-theme={currentTheme.id} aria-hidden="true" />
          </button>
          <fieldset
            id="theme-picker"
            className="theme-picker"
            onPointerDown={() => {
              pickedWithPointerRef.current = true;
            }}
            onKeyDown={() => {
              pickedWithPointerRef.current = false;
            }}
            onClick={handleThemeClick}
          >
            <legend className="sr-only">Ink colour</legend>
            {THEMES.map((option) => (
              <label key={option.id} className="theme-option" title={`${option.label} ink`}>
                <input
                  type="radio"
                  name="colour-theme"
                  value={option.id}
                  checked={theme === option.id}
                  onChange={() => onThemeChange(option.id)}
                  className="sr-only"
                />
                {/* Each pen previews its ink using the existing theme hues. */}
                <span className="theme-swatch" data-theme={option.id} aria-hidden="true" />
                <span className="sr-only">{option.label}</span>
              </label>
            ))}
          </fieldset>
        </div>
        <button
          type="button"
          className="paper-toggle"
          aria-label="Ruled paper"
          aria-pressed={ruledPaper}
          title={ruledPaper ? "Switch to plain paper" : "Switch to ruled paper"}
          onClick={onToggleRuling}
        >
          <Icon name="book-open" size={18} />
          <span>Lines</span>
        </button>
        <button
          type="button"
          className="paper-tone-toggle"
          aria-label="Dark paper"
          aria-pressed={darkPaper}
          title={darkPaper ? "Use light paper" : "Use dark paper"}
          onClick={onTogglePaperTone}
        >
          <Icon name="sun" size={18} />
        </button>
        <button
          type="button"
          className="header-add-button"
          onClick={onAdd}
          aria-label="Add word"
        >
          <Icon name="edit" size={18} />
          <span>Add word</span>
        </button>
      </div>
    </header>
  );
}

export default TopMenu;

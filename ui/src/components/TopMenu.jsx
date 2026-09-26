import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import Icon from "./Icon.jsx";
import LiquidGlassSurface from "../motion/MotionSurface.jsx";
import { THEMES } from "../theme/themes.js";

const NAV_ITEMS = [
  { id: "today", label: "Today", icon: "sun" },
  { id: "library", label: "Library", icon: "book-open" },
  { id: "practice", label: "Practice", icon: "target" },
  { id: "progress", label: "Progress", icon: "chart" },
];

function Switch({ checked, onChange, label, hint }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="appearance-switch"
      onClick={onChange}
    >
      <span className="appearance-switch-copy">
        <span>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </span>
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
    </button>
  );
}

function TopMenu({
  activePage,
  onNavigate,
  onAdd,
  ruledPaper,
  onToggleRuling,
  darkPaper,
  onPaperToneChange,
  glassEnabled,
  onToggleGlass,
  theme,
  onThemeChange,
}) {
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const appearanceRef = useRef(null);
  const toggleRef = useRef(null);

  useEffect(() => {
    if (!isAppearanceOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!appearanceRef.current?.contains(event.target)) {
        setIsAppearanceOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsAppearanceOpen(false);
        toggleRef.current?.focus();
      }
    }

    appearanceRef.current
      ?.querySelector("#appearance-menu input:checked")
      ?.focus({ preventScroll: true });
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAppearanceOpen]);

  return (
    <header id="top-menu" className="top-menu">
      <button
        type="button"
        className="brand"
        onClick={() => onNavigate("today")}
        aria-label="Vocabulary Notebook, go to Today"
      >
        <span className="brand-mark" aria-hidden="true">
          <Icon name="book-open" size={19} weight="bold" />
        </span>
        <span className="brand-name">Vocabulary</span>
      </button>

      <nav className="primary-nav" aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={activePage === item.id ? "nav-item active" : "nav-item"}
            aria-current={activePage === item.id ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <Icon name={item.icon} size={18} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="header-actions">
        <div
          ref={appearanceRef}
          className="appearance"
          onBlur={() => {
            // Close when keyboard focus moves on. A click on a control that
            // does not take focus (Safari) leaves focus on <body>, so that
            // case keeps the menu open.
            window.requestAnimationFrame(() => {
              const focused = document.activeElement;
              if (focused && focused !== document.body &&
                !appearanceRef.current?.contains(focused)) {
                setIsAppearanceOpen(false);
              }
            });
          }}
        >
          <button
            ref={toggleRef}
            type="button"
            className="appearance-toggle"
            aria-label="Appearance"
            aria-expanded={isAppearanceOpen}
            aria-controls={isAppearanceOpen ? "appearance-menu" : undefined}
            onClick={() => setIsAppearanceOpen((open) => !open)}
          >
            <Icon name="sliders" size={18} />
            <span>Appearance</span>
          </button>

          <AnimatePresence>
            {isAppearanceOpen ? (
              <LiquidGlassSurface
                key="appearance"
                motionPreset="menu"
                id="appearance-menu"
                className="appearance-menu"
                variant="menu"
                radius={18}
                intensity={0.9}
                role="dialog"
                aria-label="Appearance"
              >
                <fieldset className="appearance-group">
                  <legend>Ink</legend>
                  <div className="ink-options">
                    {THEMES.map((option) => (
                      <label key={option.id} className="ink-option">
                        <input
                          type="radio"
                          name="colour-theme"
                          value={option.id}
                          checked={theme === option.id}
                          onChange={() => onThemeChange(option.id)}
                          className="sr-only"
                        />
                        {/* data-theme gives the swatch that theme's hues from index.css. */}
                        <span className="ink-swatch" data-theme={option.id} aria-hidden="true" />
                        <span className="ink-label">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="appearance-group">
                  <legend>Paper</legend>
                  <div className="segmented">
                    {[
                      { id: "light", label: "Light", icon: "sun", dark: false },
                      { id: "dark", label: "Dark", icon: "moon", dark: true },
                    ].map((option) => (
                      <label key={option.id} className="segmented-option">
                        <input
                          type="radio"
                          name="paper-tone"
                          value={option.id}
                          checked={darkPaper === option.dark}
                          onChange={() => onPaperToneChange(option.dark)}
                          className="sr-only"
                        />
                        <span>
                          <Icon name={option.icon} size={16} />
                          {option.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="appearance-switches">
                  <Switch
                    checked={ruledPaper}
                    onChange={onToggleRuling}
                    label="Ruled lines"
                  />
                  <Switch
                    checked={glassEnabled}
                    onChange={onToggleGlass}
                    label="Glass edge light"
                    hint="Edges brighten as the pointer comes near"
                  />
                </div>
              </LiquidGlassSurface>
            ) : null}
          </AnimatePresence>
        </div>

        <button type="button" className="header-add-button" aria-label="Add word" onClick={onAdd}>
          <Icon name="plus" size={18} weight="bold" />
          <span>Add word</span>
        </button>
      </div>
    </header>
  );
}

export default TopMenu;

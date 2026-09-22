import LiquidGlassSurface from "../glass/LiquidGlassSurface.jsx";
import Icon from "./Icon.jsx";

const NAV_ITEMS = [
  { id: "today", label: "Today", icon: "sun" },
  { id: "library", label: "Library", icon: "book-open" },
  { id: "practice", label: "Practice", icon: "target" },
  { id: "progress", label: "Progress", icon: "chart" },
];

function TopMenu({ activePage, onNavigate, onAdd, glassEnabled, onToggleGlass }) {
  return (
    <LiquidGlassSurface
      as="header"
      id="top-menu"
      className="top-menu"
      variant="menu"
      radius={24}
      intensity={0.82}
      interactive
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
        <span className="brand-name">Vocabulary<span className="brand-caption">YOUR PERSONAL NOTEBOOK</span></span>
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
        <button
          type="button"
          className="glass-toggle"
          aria-label="Liquid glass cursor effect"
          aria-pressed={glassEnabled}
          title={`Liquid glass cursor: ${glassEnabled ? "on" : "off"}`}
          onClick={onToggleGlass}
        >
          <Icon name="sparkles" size={18} />
          <span>Glass</span>
          <span className="glass-toggle-indicator" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="header-add-button"
          onClick={onAdd}
          aria-label="Add word"
        >
          <Icon name="plus" size={18} />
          <span>Add word</span>
        </button>
      </div>
    </LiquidGlassSurface>
  );
}

export default TopMenu;

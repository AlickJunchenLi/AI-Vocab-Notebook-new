import LiquidGlassSurface from "../glass/LiquidGlassSurface.jsx";
import Icon from "./Icon.jsx";

const NAV_ITEMS = [
  { id: "today", label: "Today", icon: "sun" },
  { id: "library", label: "Library", icon: "book-open" },
  { id: "practice", label: "Practice", icon: "target" },
  { id: "progress", label: "Progress", icon: "chart" },
];

function TopMenu({ activePage, onNavigate, onAdd }) {
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
        <span className="brand-name">AI Vocabulary Notebook</span>
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

      <button
        type="button"
        className="header-add-button"
        onClick={onAdd}
        aria-label="Add word"
      >
        <Icon name="plus" size={18} />
        <span>Add word</span>
      </button>
    </LiquidGlassSurface>
  );
}

export default TopMenu;

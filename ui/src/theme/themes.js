// Hues live in index.css under [data-theme]; this list only names them.
export const THEMES = [
  { id: "lavender", label: "Lavender" },
  { id: "blue", label: "Blue" },
  { id: "pink", label: "Pink" },
  { id: "green", label: "Green" },
];

export const DEFAULT_THEME = "lavender";
// index.html reads this key too, so the saved theme applies before first paint.
export const THEME_STORAGE_KEY = "notebook.theme";

export function isTheme(value) {
  return THEMES.some((theme) => theme.id === value);
}

export function loadTheme() {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The theme still applies for this visit when storage is unavailable.
  }
}

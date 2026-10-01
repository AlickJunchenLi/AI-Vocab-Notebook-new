const WELCOME_KEY = "notebook.welcome";
const NAME_KEY = "notebook.name";

// The local calendar day, as YYYY-MM-DD.
export function localDay(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/*
 * Which welcome this opening of the notebook gets, when it opens on Today:
 * "full" the first time each local day, "brief" (the same moves, shorter and
 * in place) after that, or false when it opens on another page or the reader
 * has asked for less motion. When the browser can't remember the day, every
 * opening is brief, so the full one can't come back on every visit. Opening
 * the notebook with ?welcome in its address plays the full one again.
 */
export function loadWelcome(page) {
  try {
    if (page !== "today" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return false;
    }
    if (new URLSearchParams(window.location.search).has("welcome")) {
      return "full";
    }
    return window.localStorage.getItem(WELCOME_KEY) !== localDay() ? "full" : "brief";
  } catch {
    return "brief";
  }
}

export function saveWelcomeSeen() {
  try {
    window.localStorage.setItem(WELCOME_KEY, localDay());
  } catch {
    // The welcome still ends for this visit.
  }
}

// The reader's name, if they have given one; the greeting does without.
export function loadReaderName() {
  try {
    return (window.localStorage.getItem(NAME_KEY) ?? "").trim().slice(0, 40);
  } catch {
    return "";
  }
}

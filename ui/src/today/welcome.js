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
 * Whether this opening of the notebook gets the welcome: the full sequence
 * the first time it opens on Today each local day, and nothing (the usual
 * cover) otherwise. A reader who asks for less motion is shown the page as it
 * is. When the browser can't remember the day, the welcome isn't played at
 * all, so it can't come back on every visit. Opening the notebook with
 * ?welcome in its address plays it again, to see it after the day's first.
 */
export function loadWelcome(page) {
  try {
    if (page !== "today" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return false;
    }
    if (new URLSearchParams(window.location.search).has("welcome")) {
      return true;
    }
    return window.localStorage.getItem(WELCOME_KEY) !== localDay();
  } catch {
    return false;
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

/*
 * The guided tour. Each step points at one thing and says one thing about it,
 * in a sentence or two (people skim these and forget long ones). `page` is
 * the page the step needs; `target` lists selectors to try in order, so an
 * empty notebook still has something to point at; `scrollTop` keeps header
 * targets in view on small screens, where only the tabs stay pinned; `align:
 * "start"` scrolls a wide target up under the header to leave the note room
 * below it; `sides` is where the note prefers to sit; `keys` are the
 * shortcuts worth knowing.
 */
export const TOUR_STEPS = [
  {
    id: "pages",
    page: "today",
    target: [".primary-nav"],
    scrollTop: true,
    title: "Four pages, one notebook",
    body: "Today plans your study. Library keeps every word, Practice tests you, and Progress shows how it’s going.",
  },
  {
    id: "add",
    page: "today",
    target: [".header-add-button"],
    scrollTop: true,
    title: "Collect a word",
    body: "Add a word in English or Chinese with its translations and a note. It’s ready to review the same day.",
  },
  {
    id: "review",
    page: "today",
    target: ["#today-review", "#today-empty"],
    sides: ["right", "bottom", "top", "left"],
    title: "Start with today’s review",
    body: "Words that are due wait here. Your weakest words are listed underneath; open one to see it in the library.",
  },
  {
    id: "library",
    page: "library",
    target: [".library-controls"],
    title: "Every word in one place",
    body: "Search, filter by language or change the order, then choose a word to see its translations, synonyms and notes.",
    keys: [["/", "search"], ["↑ ↓", "move"], ["E", "edit"]],
  },
  {
    id: "practice",
    page: "practice",
    target: ["#practice-prompt-card", "#practice-empty-state"],
    sides: ["right", "bottom", "left", "top"],
    title: "Recall, then rate",
    body: "Try to remember the meaning before you show it, then rate how well you knew it.",
    keys: [["Space", "show meaning"], ["1 to 4", "rate"]],
  },
  {
    id: "progress",
    page: "progress",
    target: [".progress-overview-grid"],
    // Too wide for the note to sit beside it: lift it to the top instead.
    align: "start",
    title: "Watch it add up",
    body: "Your reviews by week or month, your average recall, and how far each language has come.",
  },
  {
    id: "again",
    page: "today",
    target: [".tour-toggle"],
    scrollTop: true,
    title: "Come back any time",
    body: "This button opens the tour again. Appearance, beside it, changes the ink, the paper and the ruled lines.",
  },
];

const STORAGE_KEY = "notebook.tour";

// "new" until the tour has been taken or the invitation turned down. When
// the browser can't store anything, the invitation isn't shown at all, so it
// can't come back on every visit.
export function loadTourStatus() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === null ? "new" : "seen";
  } catch {
    return "seen";
  }
}

export function saveTourSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "seen");
  } catch {
    // The invitation still goes away for this visit.
  }
}

import { useCallback, useEffect, useMemo, useState } from "react";
import "./glass/liquidGlass.css";
import "./App.css";
import TopMenu from "./components/TopMenu.jsx";
import AddWordModal from "./components/AddWordModal.jsx";
import EditWordModal from "./components/EditWordModal.jsx";
import DeleteConfirmModal from "./components/DeleteConfirmModal.jsx";
import Toast from "./components/Toast.jsx";
import TodayPage from "./pages/TodayPage.jsx";
import LibraryPage from "./pages/LibraryPage.jsx";
import PracticePage from "./pages/PracticePage.jsx";
import ProgressPage from "./pages/ProgressPage.jsx";
import { mockEntries } from "./data/mockEntries.js";
import { applyTheme } from "./theme/applyTheme.js";
import { loadTheme, saveTheme } from "./theme/themes.js";
import "./paper.css";

const STORAGE_KEY = "ai-vocabulary-notebook.entries.v3";
const PAGE_IDS = new Set(["today", "library", "practice", "progress"]);

function getPageFromHash() {
  const page = window.location.hash.replace(/^#\/?/, "");
  return PAGE_IDS.has(page) ? page : "today";
}

function loadEntries() {
  try {
    const savedEntries = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    return Array.isArray(savedEntries) ? savedEntries : mockEntries;
  } catch {
    return mockEntries;
  }
}

function getMasteryFromAssessment(assessment) {
  if (assessment === "easy") {
    return "mastered";
  }

  if (assessment === "good") {
    return "familiar";
  }

  return "developing";
}

function App() {
  const [activePage, setActivePage] = useState(getPageFromHash);
  const [entries, setEntries] = useState(loadEntries);
  const [selectedId, setSelectedId] = useState(() => {
    return mockEntries.find((entry) => entry.word === "lucid")?.id ?? mockEntries[0].id;
  });
  const [practiceQueueIds, setPracticeQueueIds] = useState(null);
  const [libraryVisit, setLibraryVisit] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [entryToDelete, setEntryToDelete] = useState(null);
  const [pendingDeletion, setPendingDeletion] = useState(null);
  const [toast, setToast] = useState(null);
  const [ruledPaper, setRuledPaper] = useState(() => {
    try {
      return window.localStorage.getItem("notebook.ruled-paper") !== "off";
    } catch {
      return true;
    }
  });
  const [storageAvailable, setStorageAvailable] = useState(() => {
    try {
      window.localStorage.getItem(STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  });

  const [theme, setTheme] = useState(loadTheme);
  const [darkPaper, setDarkPaper] = useState(() => document.documentElement.dataset.paperTone === "dark");

  function togglePaperTone() {
    const next = !darkPaper;
    setDarkPaper(next);
    document.documentElement.dataset.paperTone = next ? "dark" : "light";
    try {
      window.localStorage.setItem("notebook.paper-tone", next ? "dark" : "light");
    } catch {
      // The chosen paper still applies for this visit.
    }
  }

  function updateEntries(nextOrUpdater) {
    const nextEntries = typeof nextOrUpdater === "function"
      ? nextOrUpdater(entries)
      : nextOrUpdater;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }

    setEntries(nextEntries);
  }

  function changeTheme(nextTheme) {
    setTheme(nextTheme);
    saveTheme(nextTheme);
  }

  function toggleRuling() {
    const enabled = !ruledPaper;
    setRuledPaper(enabled);
    try {
      window.localStorage.setItem("notebook.ruled-paper", enabled ? "on" : "off");
    } catch {
      // The appearance control also works when browser storage is unavailable.
    }
  }

  const selectedEntry =
    entries.find((entry) => entry.id === selectedId) ?? entries[0] ?? null;

  const practiceEntries = useMemo(() => {
    if (!Array.isArray(practiceQueueIds) || practiceQueueIds.length === 0) {
      return entries;
    }

    const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
    return practiceQueueIds.map((id) => entriesById.get(id)).filter(Boolean);
  }, [entries, practiceQueueIds]);

  useEffect(() => {
    function handleHashChange() {
      setActivePage(getPageFromHash());
    }

    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("popstate", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("popstate", handleHashChange);
    };
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const pageName = activePage[0].toUpperCase() + activePage.slice(1);
    document.title = `${pageName} · AI Vocabulary Notebook`;
  }, [activePage]);

  function commitNavigation(page) {
    if (!PAGE_IDS.has(page)) {
      return;
    }

    setActivePage(page);
    window.history.pushState(null, "", `#/${page}`);
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }

  function navigateTo(page) {
    if (page === "practice") {
      setPracticeQueueIds(entries.map((entry) => entry.id));
    }

    commitNavigation(page);
  }

  function handleAddEntry(newEntry) {
    const entryWithDefaults = {
      pronunciation: "Pronunciation not added",
      definition: newEntry.notes || "Definition not added yet.",
      example: "Add an example sentence when you review this word.",
      mastery: "developing",
      reviewCount: 0,
      weeklyReviews: [0, 0, 0, 0, 0, 0, 0],
      lastReviewedLabel: "New word",
      dueLabel: "Due today",
      ...newEntry,
      id: newEntry.id ?? Date.now(),
    };

    updateEntries((currentEntries) => [entryWithDefaults, ...currentEntries]);
    setSelectedId(entryWithDefaults.id);
    setLibraryVisit((visit) => visit + 1);
    setIsAddModalOpen(false);
    setToast({ id: Date.now(), message: `${entryWithDefaults.word} added to your notebook.` });
    commitNavigation("library");
  }

  function handleSaveEdit(updatedEntry) {
    updateEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.id === updatedEntry.id ? updatedEntry : entry,
      ),
    );
    setSelectedId(updatedEntry.id);
    setEditingEntry(null);
    setToast({ id: Date.now(), message: `${updatedEntry.word} updated.` });
  }

  function handleConfirmDelete() {
    if (!entryToDelete) {
      return;
    }

    const deletedIndex = entries.findIndex((entry) => entry.id === entryToDelete.id);
    const remainingEntries = entries.filter(
      (entry) => entry.id !== entryToDelete.id,
    );

    setPendingDeletion({ entry: entryToDelete, index: deletedIndex });
    setToast({ id: Date.now(), message: `${entryToDelete.word} was removed.` });
    updateEntries(remainingEntries);
    if (selectedId === entryToDelete.id) {
      setSelectedId(remainingEntries[0]?.id ?? null);
    }
    setEntryToDelete(null);
  }

  function handleStartPractice(entry) {
    setPracticeQueueIds([
      entry.id,
      ...entries.filter((candidate) => candidate.id !== entry.id).map((candidate) => candidate.id),
    ]);
    commitNavigation("practice");
  }

  function handleStartReview(queue) {
    const queueIds = queue.map((entry) => entry.id);
    setPracticeQueueIds(queueIds);
    commitNavigation("practice");
  }

  function handleSelectFromToday(entry) {
    if (entry) {
      setSelectedId(entry.id);
    }

    commitNavigation("library");
  }

  const dismissToast = useCallback(() => {
    setToast(null);
    setPendingDeletion(null);
  }, []);

  function handleUndoDelete() {
    if (!pendingDeletion) {
      return;
    }

    updateEntries((currentEntries) => {
      if (currentEntries.some((entry) => entry.id === pendingDeletion.entry.id)) {
        return currentEntries;
      }

      const restoredEntries = [...currentEntries];
      const insertAt = Math.max(0, Math.min(pendingDeletion.index, restoredEntries.length));
      restoredEntries.splice(insertAt, 0, pendingDeletion.entry);
      return restoredEntries;
    });
    setSelectedId(pendingDeletion.entry.id);
    setToast({
      id: Date.now(),
      message: `${pendingDeletion.entry.word} was restored.`,
    });
    setPendingDeletion(null);
  }

  function handlePracticeEntry(entry, assessment) {
    const mastery = getMasteryFromAssessment(assessment);

    updateEntries((currentEntries) =>
      currentEntries.map((currentEntry) => {
        if (currentEntry.id !== entry.id) {
          return currentEntry;
        }

        const weeklyReviews = Array.isArray(currentEntry.weeklyReviews)
          ? [...currentEntry.weeklyReviews]
          : [0, 0, 0, 0, 0, 0, 0];
        const todayIndex = (new Date().getDay() + 6) % 7;
        weeklyReviews[todayIndex] = (weeklyReviews[todayIndex] ?? 0) + 1;

        return {
          ...currentEntry,
          mastery,
          reviewCount: (currentEntry.reviewCount ?? 0) + 1,
          weeklyReviews,
          lastReviewedLabel: "Reviewed just now",
          lastReviewedAt: new Date().toISOString(),
          dueLabel: assessment === "again" ? "Review again" : "Up to date",
        };
      }),
    );
  }

  return (
    <div className="app notebook-app" data-ruled={ruledPaper}>
      <a className="skip-link" href="#main-content" onClick={(event) => {
        event.preventDefault();
        document.getElementById("main-content")?.focus();
      }}>Skip to content</a>
      <TopMenu
        activePage={activePage}
        onNavigate={navigateTo}
        onAdd={() => setIsAddModalOpen(true)}
        ruledPaper={ruledPaper}
        onToggleRuling={toggleRuling}
        darkPaper={darkPaper}
        onTogglePaperTone={togglePaperTone}
        theme={theme}
        onThemeChange={changeTheme}
      />

      <div className="notebook-book">
      <div className="notebook-binding" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <i key={index} />)}</div>
      <div className="page-transition" id="main-content" tabIndex={-1} key={activePage}>
        {activePage === "today" ? (
          <TodayPage
            entries={entries}
            onStartReview={handleStartReview}
            onSelectEntry={handleSelectFromToday}
            onAdd={() => setIsAddModalOpen(true)}
          />
        ) : null}

        {activePage === "library" ? (
          <LibraryPage
            key={libraryVisit}
            entries={entries}
            selectedEntry={selectedEntry}
            onSelect={(entry) => setSelectedId(entry.id)}
            onAdd={() => setIsAddModalOpen(true)}
            onEdit={setEditingEntry}
            onDelete={setEntryToDelete}
            onPractice={handleStartPractice}
          />
        ) : null}

        {activePage === "practice" ? (
          <PracticePage
            entries={practiceEntries}
            onPracticeEntry={handlePracticeEntry}
          />
        ) : null}

        {activePage === "progress" ? <ProgressPage entries={entries} /> : null}
      </div>
      <footer className="notebook-footer">
        <span>{storageAvailable ? "Kept on this device" : "Storage unavailable. Changes last for this visit."}</span>
        <span className="page-folio">{[...PAGE_IDS].indexOf(activePage) + 1} / 4</span>
        <span>Your vocabulary notebook</span>
      </footer>
      </div>

      {isAddModalOpen ? (
        <AddWordModal
          entries={entries}
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleAddEntry}
        />
      ) : null}

      {editingEntry ? (
        <EditWordModal
          entry={editingEntry}
          onSave={handleSaveEdit}
          onCancel={() => setEditingEntry(null)}
        />
      ) : null}

      {entryToDelete ? (
        <DeleteConfirmModal
          entry={entryToDelete}
          onConfirm={handleConfirmDelete}
          onCancel={() => setEntryToDelete(null)}
        />
      ) : null}

      {toast ? (
        <Toast
          key={toast.id}
          message={toast.message}
          actionLabel={pendingDeletion ? "Undo" : undefined}
          onAction={pendingDeletion ? handleUndoDelete : undefined}
          onDismiss={dismissToast}
        />
      ) : null}
    </div>
  );
}

export default App;

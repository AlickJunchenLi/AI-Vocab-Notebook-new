import { useEffect, useMemo, useState } from "react";
import "./glass/liquidGlass.css";
import "./App.css";
import LiquidGlassGroup from "./glass/LiquidGlassGroup.jsx";
import TopMenu from "./components/TopMenu.jsx";
import AddWordModal from "./components/AddWordModal.jsx";
import EditWordModal from "./components/EditWordModal.jsx";
import DeleteConfirmModal from "./components/DeleteConfirmModal.jsx";
import LibraryPage from "./pages/LibraryPage.jsx";
import PracticePage from "./pages/PracticePage.jsx";
import ProgressPage from "./pages/ProgressPage.jsx";
import { mockEntries } from "./data/mockEntries.js";

const STORAGE_KEY = "ai-vocabulary-notebook.entries.v3";
const PAGE_IDS = new Set(["library", "practice", "progress"]);

function getPageFromHash() {
  const page = window.location.hash.replace(/^#\/?/, "");
  return PAGE_IDS.has(page) ? page : "library";
}

function loadEntries() {
  try {
    const savedEntries = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    return Array.isArray(savedEntries) && savedEntries.length > 0
      ? savedEntries
      : mockEntries;
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
  const [practiceStartId, setPracticeStartId] = useState(() => {
    return mockEntries.find((entry) => entry.word === "lucid")?.id ?? null;
  });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [entryToDelete, setEntryToDelete] = useState(null);

  const selectedEntry =
    entries.find((entry) => entry.id === selectedId) ?? entries[0] ?? null;

  const practiceEntries = useMemo(() => {
    if (!practiceStartId) {
      return entries;
    }

    const requestedEntry = entries.find((entry) => entry.id === practiceStartId);
    return requestedEntry
      ? [requestedEntry, ...entries.filter((entry) => entry.id !== practiceStartId)]
      : entries;
  }, [entries, practiceStartId]);

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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    const pageName = activePage[0].toUpperCase() + activePage.slice(1);
    document.title = `${pageName} · AI Vocabulary Notebook`;
  }, [activePage]);

  function navigateTo(page) {
    if (!PAGE_IDS.has(page)) {
      return;
    }

    setActivePage(page);
    if (page === "practice" && !practiceStartId) {
      setPracticeStartId(selectedEntry?.id ?? null);
    }
    window.history.pushState(null, "", `#/${page}`);
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }

  function handleAddEntry(newEntry) {
    const entryWithDefaults = {
      pronunciation: "Pronunciation not added",
      definition: newEntry.notes || "Definition not added yet.",
      example: "Add an example sentence when you review this word.",
      mastery: "developing",
      reviewCount: 0,
      weeklyReviews: [0, 0, 0, 0, 0, 0, 0],
      recallRate: 0,
      lastReviewedLabel: "New word",
      dueLabel: "Due today",
      ...newEntry,
      id: newEntry.id ?? Date.now(),
    };

    setEntries((currentEntries) => [entryWithDefaults, ...currentEntries]);
    setSelectedId(entryWithDefaults.id);
    setIsAddModalOpen(false);
    navigateTo("library");
  }

  function handleSaveEdit(updatedEntry) {
    setEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.id === updatedEntry.id ? updatedEntry : entry,
      ),
    );
    setSelectedId(updatedEntry.id);
    setEditingEntry(null);
  }

  function handleConfirmDelete() {
    if (!entryToDelete) {
      return;
    }

    const remainingEntries = entries.filter(
      (entry) => entry.id !== entryToDelete.id,
    );

    setEntries(remainingEntries);
    if (selectedId === entryToDelete.id) {
      setSelectedId(remainingEntries[0]?.id ?? null);
    }
    setEntryToDelete(null);
  }

  function handleStartPractice(entry) {
    setPracticeStartId(entry.id);
    navigateTo("practice");
  }

  function handlePracticeEntry(entry, assessment) {
    const mastery = getMasteryFromAssessment(assessment);

    setEntries((currentEntries) =>
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
          dueLabel: assessment === "again" ? "Review again" : "Up to date",
        };
      }),
    );
  }

  return (
    <LiquidGlassGroup
      className="app"
      overscan={168}
      spillRadius={240}
      maxActiveSurfaces={3}
    >
      <div className="ambient-field" aria-hidden="true">
        <span className="ambient-field-blue" />
        <span className="ambient-field-violet" />
      </div>

      <TopMenu
        activePage={activePage}
        onNavigate={navigateTo}
        onAdd={() => setIsAddModalOpen(true)}
      />

      <div className="page-transition" key={activePage}>
        {activePage === "library" ? (
          <LibraryPage
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

      {isAddModalOpen ? (
        <AddWordModal
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
    </LiquidGlassGroup>
  );
}

export default App;

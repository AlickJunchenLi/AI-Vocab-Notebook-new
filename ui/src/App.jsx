import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import "./glass/liquidGlass.css";
import "./App.css";
import LiquidGlassGroup from "./glass/LiquidGlassGroup.jsx";
import TopMenu from "./components/TopMenu.jsx";
// The pages after Today, the word dialogs and the tour load on demand
// (lazyParts.js), but their styles stay in the first stylesheet, at the
// places they always had in it, so nothing is restyled when they arrive.
import "./components/glassSelect.css";
import Toast from "./components/Toast.jsx";
import NotebookOpening from "./components/NotebookOpening.jsx";
import { shouldOpenNotebook } from "./components/notebookOpening.js";
import TodayPage from "./pages/TodayPage.jsx";
import "./libraryNotebook.css";
import "./studyNotebook.css";
import PageTurn from "./motion/PageTurn.jsx";
import PageFrame from "./motion/PageFrame.jsx";
import NotebookBinding from "./components/NotebookBinding.jsx";
import {
  AddWordModal,
  DeleteConfirmModal,
  EditWordModal,
  LibraryPage,
  PracticePage,
  ProgressPage,
  TourGuide,
  preloadWhenIdle,
  whenPageReady,
} from "./lazyParts.js";
import { loadTourStatus, saveTourSeen } from "./tour/tourSteps.js";
import { HandwritingContext, loadHandwriting, saveHandwriting } from "./motion/handwriting.js";
import { mockEntries } from "./data/mockEntries.js";
import { applyTheme, syncThemeColor } from "./theme/applyTheme.js";
import { loadTheme, saveTheme } from "./theme/themes.js";

const STORAGE_KEY = "ai-vocabulary-notebook.entries.v3";
// The order of the page tabs, left to right.
const PAGE_ORDER = ["today", "library", "practice", "progress"];
const PAGE_IDS = new Set(PAGE_ORDER);

function getPageFromHash() {
  const page = window.location.hash.replace(/^#\/?/, "");
  return PAGE_IDS.has(page) ? page : "today";
}

// Moving to a tab further right turns the notebook forward (1), further left
// turns it back (-1).
function turnTo(page) {
  return (view) => view.page === page ? view : {
    page,
    turn: Math.sign(PAGE_ORDER.indexOf(page) - PAGE_ORDER.indexOf(view.page)),
  };
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
  const [view, setView] = useState(() => ({ page: getPageFromHash(), turn: 0 }));
  const activePage = view.page;
  // The latest page asked for; an earlier one whose file arrives later is
  // not turned to.
  const pageRequest = useRef(0);

  // Turns to a page once its file is there, so it never turns in empty.
  const showPage = useCallback((page, then) => {
    const request = ++pageRequest.current;
    const turn = () => {
      if (pageRequest.current === request) {
        setView(turnTo(page));
        then?.();
      }
    };
    const pending = whenPageReady(page);

    if (pending) {
      pending.then(turn);
    } else {
      turn();
    }
  }, []);
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
  const [glassEnabled, setGlassEnabled] = useState(() => {
    try {
      return window.localStorage.getItem("notebook.liquid-glass") !== "off";
    } catch {
      return true;
    }
  });
  const [handwriting, setHandwriting] = useState(loadHandwriting);
  const [storageAvailable, setStorageAvailable] = useState(() => {
    try {
      window.localStorage.getItem(STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  });

  const [isOpening, setIsOpening] = useState(shouldOpenNotebook);
  const finishOpening = useCallback(() => setIsOpening(false), []);
  // "new" until the tour has been taken or its invitation turned down.
  const [tourStatus, setTourStatus] = useState(loadTourStatus);
  const [isTourOpen, setIsTourOpen] = useState(false);

  const putTourAway = useCallback(() => {
    setTourStatus("seen");
    saveTourSeen();
  }, []);

  const endTour = useCallback(() => {
    setIsTourOpen(false);
    putTourAway();
  }, [putTourAway]);
  const [theme, setTheme] = useState(loadTheme);
  const [darkPaper, setDarkPaper] = useState(() => document.documentElement.dataset.paperTone === "dark");

  function changePaperTone(dark) {
    setDarkPaper(dark);
    document.documentElement.dataset.paperTone = dark ? "dark" : "light";
    syncThemeColor();
    try {
      window.localStorage.setItem("notebook.paper-tone", dark ? "dark" : "light");
    } catch {
      // The chosen paper still applies for this visit.
    }
  }

  function toggleGlass() {
    const enabled = !glassEnabled;
    setGlassEnabled(enabled);
    try {
      window.localStorage.setItem("notebook.liquid-glass", enabled ? "on" : "off");
    } catch {
      // The appearance control also works when browser storage is unavailable.
    }
  }

  function toggleHandwriting() {
    const enabled = !handwriting;
    setHandwriting(enabled);
    saveHandwriting(enabled);
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
      showPage(getPageFromHash());
    }

    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("popstate", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("popstate", handleHashChange);
    };
  }, [showPage]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // The first theme is applied by index.html before React starts, so the
  // browser bars are matched to it here.
  useEffect(() => {
    syncThemeColor();
  }, []);

  // Fetch the other pages, the dialogs and the tour once the notebook is idle.
  useEffect(() => preloadWhenIdle(), []);

  useEffect(() => {
    const pageName = activePage[0].toUpperCase() + activePage.slice(1);
    document.title = `${pageName} - Vocabulary Notebook`;
  }, [activePage]);

  function commitNavigation(page) {
    if (!PAGE_IDS.has(page)) {
      return;
    }

    showPage(page, () => {
      window.history.pushState(null, "", `#/${page}`);
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
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
    <HandwritingContext value={handwriting}>
      <LiquidGlassGroup className="app notebook-app" data-ruled={ruledPaper} enabled={glassEnabled}>
        <a className="skip-link" href="#main-content" onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}>Skip to content</a>
        <TopMenu
          activePage={activePage}
          onNavigate={navigateTo}
          onAdd={() => setIsAddModalOpen(true)}
          onStartTour={() => setIsTourOpen(true)}
          ruledPaper={ruledPaper}
          onToggleRuling={toggleRuling}
          darkPaper={darkPaper}
          onPaperToneChange={changePaperTone}
          glassEnabled={glassEnabled}
          onToggleGlass={toggleGlass}
          handwriting={handwriting}
          onToggleHandwriting={toggleHandwriting}
          theme={theme}
          onThemeChange={changeTheme}
        />

        <div className="notebook-book">
          <NotebookBinding />
          <PageFrame page={activePage}>
            <AnimatePresence mode="wait" initial={false} custom={view.turn}>
              <PageTurn className="page-transition" id="main-content" tabIndex={-1} key={activePage} turn={view.turn}>
                <Suspense fallback={null}>
                  {activePage === "today" ? (
                    <TodayPage
                      entries={entries}
                      onStartReview={handleStartReview}
                      onSelectEntry={handleSelectFromToday}
                      onAdd={() => setIsAddModalOpen(true)}
                      showTourInvite={tourStatus === "new" && !isTourOpen}
                      onStartTour={() => setIsTourOpen(true)}
                      onDismissTour={putTourAway}
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
                </Suspense>
              </PageTurn>
            </AnimatePresence>
          </PageFrame>
          <footer className="notebook-footer">
            <p data-error={!storageAvailable || undefined}>
              {storageAvailable
                ? "Your words are saved in this browser."
                : "This browser is not saving changes. They will be lost when you leave."}
            </p>
          </footer>
          {isOpening ? (
            <NotebookOpening
              words={entries.length}
              languages={new Set(entries.map((entry) => entry.language)).size}
              onDone={finishOpening}
            />
          ) : null}
        </div>

        <Suspense fallback={null}>
          <AnimatePresence>
            {isAddModalOpen ? (
              <AddWordModal
                key="add-word"
                entries={entries}
                onClose={() => setIsAddModalOpen(false)}
                onAdd={handleAddEntry}
              />
            ) : null}

            {editingEntry ? (
              <EditWordModal
                key={`edit-${editingEntry.id}`}
                entry={editingEntry}
                onSave={handleSaveEdit}
                onCancel={() => setEditingEntry(null)}
              />
            ) : null}

            {entryToDelete ? (
              <DeleteConfirmModal
                key={`delete-${entryToDelete.id}`}
                entry={entryToDelete}
                onConfirm={handleConfirmDelete}
                onCancel={() => setEntryToDelete(null)}
              />
            ) : null}
          </AnimatePresence>
        </Suspense>

        <Suspense fallback={null}>
          <AnimatePresence>
            {isTourOpen ? (
              <TourGuide
                key="tour"
                activePage={activePage}
                onNavigate={navigateTo}
                onClose={endTour}
              />
            ) : null}
          </AnimatePresence>
        </Suspense>

        <AnimatePresence mode="wait">
          {toast ? (
            <Toast
              key={toast.id}
              message={toast.message}
              actionLabel={pendingDeletion ? "Undo" : undefined}
              onAction={pendingDeletion ? handleUndoDelete : undefined}
              onDismiss={dismissToast}
            />
          ) : null}
        </AnimatePresence>
      </LiquidGlassGroup>
    </HandwritingContext>
  );
}

export default App;

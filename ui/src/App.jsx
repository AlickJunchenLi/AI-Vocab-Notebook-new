import { useState } from "react";
import "./glass/liquidGlass.css";
import "./App.css";
import LiquidGlassGroup from "./glass/LiquidGlassGroup.jsx";
import LiquidGlassSurface from "./glass/LiquidGlassSurface.jsx";
import TopMenu from "./components/TopMenu.jsx";
import WordCard from "./components/WordCard";
import { mockEntries } from "./data/mockEntries";
import DetailPanel from "./components/DetailPanel";
import AddWordModal from "./components/AddWordModal";
import EditWordModal from "./components/EditWordModal";
import DeleteConfirmModal from "./components/DeleteConfirmModal";

function App() {
  const [searchText, setSearchText] = useState("");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("az");
  const [entries, setEntries] = useState(mockEntries);
  const [selectedEntry, setSelectedEntry] = useState(mockEntries[0]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [entryToDelete, setEntryToDelete] = useState(null);

  const filteredEntries = entries
    .filter((entry) => {
      const searchTarget = [
        entry.word,
        entry.language,
        Array.isArray(entry.synonyms) ? entry.synonyms.join(" ") : entry.synonym,
        Array.isArray(entry.translations)
          ? entry.translations.join(" ")
          : entry.translation,
        entry.notes,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchTarget.includes(searchText.toLowerCase());

      const matchesLanguage =
        languageFilter === "all" || entry.language === languageFilter;

      return matchesSearch && matchesLanguage;
    })
    .sort((a, b) => {
      if (sortOrder === "az") {
        return a.word.localeCompare(b.word);
      }

      return b.word.localeCompare(a.word);
    });

  function handleAddEntry(newEntry) {
    const entryWithId = {
        ...newEntry,
        id: newEntry.id ?? Date.now(),
    };

    setEntries((previousEntries) => [entryWithId, ...previousEntries]);
    setSelectedEntry(entryWithId);
    setIsAddModalOpen(false);
  }

  function handleStartEdit(entry) {
    setEditingEntry(entry);
  }

  function handleSelectEntry(entry) {
    setSelectedEntry(entry);
  }

  function handleSaveEdit(updatedEntry) {
    setEntries((previousEntries) =>
    previousEntries.map((entry) =>
        entry.id === updatedEntry.id ? updatedEntry : entry
    )
    );

    setSelectedEntry(updatedEntry);
    setEditingEntry(null);
  }

  function handleStartDelete(entry) {
    setEntryToDelete(entry);
  }

  function handleConfirmDelete() {
    if (!entryToDelete) {
      return;
    }

    const deleteId = entryToDelete.id;

    setEntries((previousEntries) => {
      const remainingEntries = previousEntries.filter(
        (entry) => entry.id !== deleteId
      );

      setSelectedEntry((currentSelectedEntry) => {
        if (currentSelectedEntry?.id === deleteId) {
          return remainingEntries[0] ?? null;
        }

        return currentSelectedEntry;
      });

      return remainingEntries;
    });

    setEntryToDelete(null);
  }

  return (
    <LiquidGlassGroup
      className="app"
      overscan={140}
      spillRadius={210}
      maxActiveSurfaces={6}
    >
      <TopMenu />

      <main className="page">
        <header className="page-header">
          <p className="eyebrow">AI Vocabulary Notebook</p>
          <h1>Vocabulary</h1>
          <p className="page-description">
            Search, review, and manage bilingual entries
          </p>
        </header>

        <LiquidGlassSurface
          as="section"
          id="controls-bar"
          className="controls"
          variant="panel"
          radius={24}
          intensity={0.86}
        >
          <input
            type="text"
            placeholder="Search words..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />

          <select
            value={languageFilter}
            onChange={(event) => setLanguageFilter(event.target.value)}
          >
            <option value="all">Language: All</option>
            <option value="English">English</option>
            <option value="Chinese">Chinese</option>
          </select>

          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          >
            <option value="az">Sort: A → Z</option>
            <option value="za">Sort: Z → A</option>
          </select>

          <button
            className="add-button top-add-word-button"
            onClick={() => setIsAddModalOpen(true)}
          >
            <span className="top-add-word-button-label">+ Add Word</span>
          </button>
        </LiquidGlassSurface>

        <section className="content-layout">
          <section className="word-grid">
            {filteredEntries.map((entry) => (
              <WordCard
                key={entry.id}
                entry={entry}
                onSelect={handleSelectEntry}
                isSelected={selectedEntry?.id === entry.id}
              />
            ))}
          </section>

          <DetailPanel
            entry={selectedEntry}
            onDelete={handleStartDelete}
            onEdit={handleStartEdit}
          />
          
        </section>

        {filteredEntries.length === 0 && (
          <p className="empty-state">No matching words found.</p>
        )}
      </main>
      {isAddModalOpen && (
        <AddWordModal
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleAddEntry}
        />
      )}

      {editingEntry && (
        <EditWordModal
            entry={editingEntry}
            onSave={handleSaveEdit}
            onCancel={() => setEditingEntry(null)}
        />
      )}

      {entryToDelete && (
        <DeleteConfirmModal
          entry={entryToDelete}
          onConfirm={handleConfirmDelete}
          onCancel={() => setEntryToDelete(null)}
        />
      )}
    </LiquidGlassGroup>
  );
}

export default App;

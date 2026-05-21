import { useState } from "react";
import "./App.css";
import TopMenu from "./components/TopMenu.jsx";
import WordCard from "./components/WordCard";
import { mockEntries } from "./data/mockEntries";
import DetailPanel from "./components/DetailPanel";
import AddWordModal from "./components/AddWordModal";

function App() {
  const [searchText, setSearchText] = useState("");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("az");
  const [entries, setEntries] = useState(mockEntries);
  const [selectedEntry, setSelectedEntry] = useState(mockEntries[0]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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

  function handleDeleteEntry(entryToDelete) {
    if (!entryToDelete) return;

    const updatedEntries = entries.filter(
        (entry) => entry.id !== entryToDelete.id
    );

    setEntries(updatedEntries);

    setSelectedEntry((previousSelectedEntry) => {
        if (previousSelectedEntry?.id === entryToDelete.id) {
        return updatedEntries[0] || null;
        }

        return previousSelectedEntry;
    });
  }



  return (
    <div className="app">
      <TopMenu />

      <main className="page">
        <header className="page-header">
          <p className="eyebrow">AI Vocabulary Notebook</p>
          <h1>Vocabulary</h1>
          <p className="page-description">
            Search, review, and manage bilingual entries
          </p>
        </header>

        <section className="controls">
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

          <button className="add-button" onClick={() => setIsAddModalOpen(true)}>
            + Add Word
          </button>
        </section>

        <section className="content-layout">
          <section className="word-grid">
            {filteredEntries.map((entry) => (
              <WordCard
                key={entry.id}
                entry={entry}
                onSelect={setSelectedEntry}
                isSelected={selectedEntry?.id === entry.id}
              />
            ))}
          </section>

          <DetailPanel entry={selectedEntry}
            onDelete={handleDeleteEntry} />
          
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
    </div>
  );
}

export default App;

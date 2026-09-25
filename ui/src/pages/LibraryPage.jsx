import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import "../libraryNotebook.css";

const LANGUAGE_OPTIONS = [
  { value: "all", label: "All languages" },
  { value: "English", label: "English" },
  { value: "Chinese", label: "Chinese" },
];

const SORT_OPTIONS = [
  { value: "recent", label: "Recently added" },
  { value: "az", label: "A to Z" },
  { value: "za", label: "Z to A" },
];

function listText(arrayValue, fallback = "Not added yet") {
  return Array.isArray(arrayValue) && arrayValue.length > 0
    ? arrayValue.join(", ")
    : fallback;
}

function primaryTranslation(entry) {
  if (!Array.isArray(entry.translations) || entry.translations.length === 0) {
    return "Translation not added";
  }

  return entry.translations.slice(0, 2).join(" · ");
}

function getLanguageDirection(language) {
  return language === "Chinese" ? "ZH → EN" : "EN → ZH";
}

function speakWord(entry) {
  if (!("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(entry.word);
  utterance.lang = entry.language === "Chinese" ? "zh-CN" : "en-US";
  window.speechSynthesis.speak(utterance);
}

function LibraryPage({
  entries,
  selectedEntry,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  onPractice,
}) {
  const [searchText, setSearchText] = useState("");
  const [language, setLanguage] = useState("all");
  const [sortOrder, setSortOrder] = useState("recent");
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const wordListRef = useRef(null);
  const detailRef = useRef(null);
  const searchRef = useRef(null);
  const moreActionRef = useRef(null);
  const moreButtonRef = useRef(null);
  const deleteButtonRef = useRef(null);

  useEffect(() => {
    function handleSearchShortcut(event) {
      if (
        event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey ||
        document.querySelector('[role="dialog"], [role="alertdialog"], dialog[open]') ||
        event.target.closest?.('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }

      event.preventDefault();
      searchRef.current?.focus();
    }

    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, []);

  useEffect(() => {
    if (!isMoreOpen) {
      return undefined;
    }

    deleteButtonRef.current?.focus();

    function dismissOutside(event) {
      if (!moreActionRef.current?.contains(event.target)) {
        setIsMoreOpen(false);
      }
    }

    document.addEventListener("pointerdown", dismissOutside);
    return () => document.removeEventListener("pointerdown", dismissOutside);
  }, [isMoreOpen]);

  const filteredEntries = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return entries
      .filter((entry) => {
        const searchable = [
          entry.word,
          entry.language,
          entry.pronunciation,
          entry.notes,
          entry.definition,
          ...(entry.synonyms ?? []),
          ...(entry.translations ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          (language === "all" || entry.language === language) &&
          (!query || searchable.includes(query))
        );
      })
      .sort((first, second) => {
        if (sortOrder === "az") {
          return first.word.localeCompare(second.word);
        }

        if (sortOrder === "za") {
          return second.word.localeCompare(first.word);
        }

        return Number(second.id) - Number(first.id);
      });
  }, [entries, language, searchText, sortOrder]);

  const visibleSelectedEntry =
    filteredEntries.find((entry) => entry.id === selectedEntry?.id) ??
    filteredEntries[0] ??
    null;
  const languageCount = new Set(entries.map((entry) => entry.language)).size;
  const dueCount = entries.filter((entry) => {
    const dueLabel = String(entry.dueLabel || "Due today").toLowerCase();
    return dueLabel.includes("due") || dueLabel.includes("review again");
  }).length;

  function clearFilters() {
    setSearchText("");
    setLanguage("all");
    setIsMoreOpen(false);
    searchRef.current?.focus();
  }

  function openEntry(entry) {
    onSelect(entry);
    setIsMoreOpen(false);

    if (window.matchMedia("(max-width: 800px)").matches) {
      detailRef.current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
  }

  function requestDelete(entry) {
    // Give the dialog a return target that survives removing the selected row
    // or closing the action menu. The detail sheet disappears with the last match.
    const returnTarget = filteredEntries.length > 1
      ? moreButtonRef.current
      : searchRef.current;
    returnTarget?.focus({ preventScroll: true });
    setIsMoreOpen(false);
    onDelete(entry);
  }

  /*
   * The list is one composite widget, not a run of buttons: only the selected row
   * is a tab stop, and the arrows move within it. Selection follows focus so
   * opening a notebook entry works just as well without a pointer.
   */
  function selectRowAt(index) {
    const entry = filteredEntries[index];

    if (!entry) {
      return;
    }

    onSelect(entry);
    setIsMoreOpen(false);

    const row = wordListRef.current?.querySelector(
      `[data-word-row="${CSS.escape(String(entry.id))}"]`,
    );

    row?.focus();
    row?.scrollIntoView({ block: "nearest" });
  }

  function handleListKeyDown(event) {
    if (filteredEntries.length === 0 || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const currentIndex = Math.max(
      0,
      filteredEntries.findIndex((entry) => entry.id === visibleSelectedEntry?.id),
    );
    const lastIndex = filteredEntries.length - 1;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        selectRowAt(Math.min(currentIndex + 1, lastIndex));
        break;
      case "ArrowUp":
        event.preventDefault();
        selectRowAt(Math.max(currentIndex - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        selectRowAt(0);
        break;
      case "End":
        event.preventDefault();
        selectRowAt(lastIndex);
        break;
      case "Enter":
        // Focus and selection are the same row here, so Enter can mean "open"
        // rather than "select" - and the primary thing to do with a word is drill it.
        event.preventDefault();
        onPractice(filteredEntries[currentIndex]);
        break;
      case "e":
      case "E":
        event.preventDefault();
        onEdit(filteredEntries[currentIndex]);
        break;
      case "Delete":
        event.preventDefault();
        requestDelete(filteredEntries[currentIndex]);
        break;
      default:
        break;
    }
  }

  return (
    <main className="page library-page notebook-library" aria-labelledby="library-page-title">
      <header className="page-heading library-heading">
        <div>
          <h1 id="library-page-title">Your vocabulary</h1>
          <p>Words you’ve collected. Thoughts in the margins.</p>
        </div>
      </header>

      <section
        id="library-summary"
        className="library-summary"
        aria-label="Vocabulary summary"
      >
        <div className="summary-item">
          <Icon name="book-open" size={24} />
          <strong>{entries.length}</strong>
          <span>{entries.length === 1 ? "word" : "words"}</span>
        </div>
        <div className="summary-divider" aria-hidden="true" />
        <div className="summary-item">
          <Icon name="globe" size={24} />
          <strong>{languageCount}</strong>
          <span>{languageCount === 1 ? "language" : "languages"}</span>
        </div>
        <div className="summary-divider" aria-hidden="true" />
        <div className="summary-item">
          <Icon name="calendar" size={24} />
          <strong>{dueCount}</strong>
          <span>due today</span>
        </div>
      </section>

      <section className="library-workspace">
        <div className="library-collection">
          <div className="library-controls">
            <label className="search-control">
              <span className="sr-only">Search your words</span>
              <Icon name="search" size={20} />
              <input
                ref={searchRef}
                type="search"
                placeholder="Search your words"
                aria-label="Search your words"
                aria-keyshortcuts="/"
                title="Search your words (/)"
                value={searchText}
                onChange={(event) => {
                  setSearchText(event.target.value);
                  setIsMoreOpen(false);
                }}
              />
              {searchText ? (
                <button
                  type="button"
                  className="clear-search"
                  onClick={() => {
                    setSearchText("");
                    searchRef.current?.focus();
                  }}
                >
                  Clear
                </button>
              ) : null}
            </label>

            <label className="notebook-library-select">
              <span className="sr-only">Filter by language</span>
              <Icon name="globe" size={17} />
              <select
                value={language}
                onChange={(event) => {
                  setLanguage(event.target.value);
                  setIsMoreOpen(false);
                }}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="notebook-library-select">
              <span className="sr-only">Sort vocabulary</span>
              <Icon name="sort" size={17} />
              <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div
            className="word-list"
            role="group"
            aria-label="Vocabulary words"
            aria-describedby={filteredEntries.length > 0 ? "word-list-shortcuts" : undefined}
            ref={wordListRef}
            onKeyDown={handleListKeyDown}
          >
            <div className="word-list-header" aria-hidden="true">
              <span>Word index</span>
              <span>Review</span>
            </div>

            {filteredEntries.map((entry) => {
              const isSelected = visibleSelectedEntry?.id === entry.id;

              return (
                <button
                  key={entry.id}
                  type="button"
                  className={isSelected ? "word-row selected" : "word-row"}
                  data-word-row={entry.id}
                  aria-pressed={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => openEntry(entry)}
                >
                  <span className="word-row-title">
                    <strong>{entry.word}</strong>
                    <span>{primaryTranslation(entry)}</span>
                  </span>
                  <span className="language-direction">
                    {getLanguageDirection(entry.language)}
                  </span>
                  <span className="word-row-note">{entry.notes}</span>
                  <span className="review-status">
                    <span>{entry.lastReviewedLabel ?? "New word"}</span>
                    <strong>{entry.dueLabel ?? "Due today"}</strong>
                  </span>
                  <Icon name="chevron-right" size={17} />
                </button>
              );
            })}

            {filteredEntries.length === 0 ? (
              <div className="library-empty-state">
                <span className="empty-icon" aria-hidden="true">
                  <Icon name="search" size={26} />
                </span>
                <h2>{entries.length === 0 ? "Your next word starts here" : "No words match that search"}</h2>
                <p>{entries.length === 0 ? "Save a word, add its meaning, and make it yours." : "Try another term or clear the filters to see your library."}</p>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={entries.length === 0 ? onAdd : clearFilters}
                >
                  {entries.length === 0 ? "Add your first word" : "Clear filters"}
                </button>
              </div>
            ) : null}
          </div>

          <p className="collection-count">
            <span role="status" aria-atomic="true">
              Showing {filteredEntries.length} of {entries.length} words
            </span>
            {filteredEntries.length > 0 ? (
              <span id="word-list-shortcuts" className="collection-shortcuts">
                <kbd>/</kbd> search
                <span aria-hidden="true">·</span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> move
                <span aria-hidden="true">·</span>
                <kbd>Enter</kbd> practice
                <span aria-hidden="true">·</span>
                <kbd>E</kbd> edit
                <span aria-hidden="true">·</span>
                <kbd>Delete</kbd> remove
              </span>
            ) : null}
          </p>
        </div>

        {visibleSelectedEntry ? (
          <aside
            ref={detailRef}
            id={`detail-${visibleSelectedEntry.id}`}
            className="library-detail"
            aria-label={`Details for ${visibleSelectedEntry.word}`}
          >
            <div className="detail-heading-row">
              <div>
                <h2 key={visibleSelectedEntry.id}>{visibleSelectedEntry.word}</h2>
                <div className="pronunciation-row">
                  <span>{visibleSelectedEntry.pronunciation}</span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Hear ${visibleSelectedEntry.word}`}
                    onClick={() => speakWord(visibleSelectedEntry)}
                  >
                    <Icon name="volume" size={18} />
                  </button>
                </div>
              </div>
              <span className="detail-language-tag">
                {visibleSelectedEntry.language}
              </span>
            </div>

            <dl className="detail-definition-list" key={visibleSelectedEntry.id}>
              <div>
                <dt>Translation</dt>
                <dd>{listText(visibleSelectedEntry.translations)}</dd>
              </div>
              <div>
                <dt>Synonyms</dt>
                <dd>{listText(visibleSelectedEntry.synonyms)}</dd>
              </div>
              <div>
                <dt>Notes</dt>
                <dd>{visibleSelectedEntry.notes || "No notes yet"}</dd>
              </div>
            </dl>

            <div className="detail-actions">
              <button
                type="button"
                className="primary-action"
                onClick={() => onPractice(visibleSelectedEntry)}
              >
                <Icon name="target" size={18} />
                Practice
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => onEdit(visibleSelectedEntry)}
              >
                <Icon name="edit" size={18} />
                Edit
              </button>
              <div
                className="more-action-wrap"
                ref={moreActionRef}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setIsMoreOpen(false);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && isMoreOpen) {
                    event.preventDefault();
                    setIsMoreOpen(false);
                    moreButtonRef.current?.focus();
                  }
                }}
              >
                <button
                  ref={moreButtonRef}
                  type="button"
                  className="icon-button action-more"
                  aria-label="More actions"
                  aria-expanded={isMoreOpen}
                  aria-controls={isMoreOpen ? "word-more-actions" : undefined}
                  onClick={() => setIsMoreOpen((isOpen) => !isOpen)}
                >
                  <Icon name="more" size={20} />
                </button>
                {isMoreOpen ? (
                  <div className="more-menu" id="word-more-actions">
                    <button
                      ref={deleteButtonRef}
                      type="button"
                      onClick={() => requestDelete(visibleSelectedEntry)}
                    >
                      <Icon name="trash" size={17} />
                      Delete word
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        ) : (
          <aside
            ref={detailRef}
            id="library-detail-empty"
            className="library-detail empty-detail"
          >
            <Icon name="book-open" size={34} />
            <h2>{entries.length === 0 ? "Your library is ready" : "Find your next word"}</h2>
            <p>{entries.length === 0 ? "Add your first word to begin building a practice queue." : "Clear your filters to browse the words in your library."}</p>
            <button type="button" className="primary-action" onClick={entries.length === 0 ? onAdd : clearFilters}>
              <Icon name={entries.length === 0 ? "plus" : "search"} size={18} />
              {entries.length === 0 ? "Add word" : "Clear filters"}
            </button>
          </aside>
        )}
      </section>
    </main>
  );
}

export default LibraryPage;

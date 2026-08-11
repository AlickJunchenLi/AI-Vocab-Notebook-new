import { useMemo, useRef, useState } from "react";
import GlassSelect from "../components/GlassSelect.jsx";
import Icon from "../components/Icon.jsx";
import LiquidGlassSurface from "../glass/LiquidGlassSurface.jsx";
import GlassSelector from "../lens/GlassSelector.jsx";

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

  /*
   * The list is one composite widget, not a run of buttons: only the selected row
   * is a tab stop, and the arrows move within it. Selection follows focus, which
   * is what makes the glass selector track the keyboard for free - it reads the
   * same activeKey either way.
   */
  function selectRowAt(index) {
    const entry = filteredEntries[index];

    if (!entry) {
      return;
    }

    onSelect(entry);
    setIsMoreOpen(false);

    const row = wordListRef.current?.querySelector(
      `[data-glass-row="${CSS.escape(String(entry.id))}"]`,
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
      case "Backspace":
        event.preventDefault();
        onDelete(filteredEntries[currentIndex]);
        break;
      default:
        break;
    }
  }

  return (
    <main className="page library-page">
      <header className="page-heading library-heading">
        <div>
          <h1>Your vocabulary</h1>
          <p>A living collection of words worth remembering.</p>
        </div>
      </header>

      <LiquidGlassSurface
        as="section"
        id="library-summary"
        className="library-summary"
        variant="panel"
        radius={20}
        intensity={0.72}
        interactive={false}
        aria-label="Vocabulary summary"
      >
        <div className="summary-item">
          <Icon name="book-open" size={24} />
          <strong>{entries.length}</strong>
          <span>words</span>
        </div>
        <div className="summary-divider" aria-hidden="true" />
        <div className="summary-item">
          <Icon name="globe" size={24} />
          <strong>{languageCount}</strong>
          <span>languages</span>
        </div>
        <div className="summary-divider" aria-hidden="true" />
        <div className="summary-item">
          <Icon name="calendar" size={24} />
          <strong>{entries.length}</strong>
          <span>due today</span>
        </div>
      </LiquidGlassSurface>

      <section className="library-workspace">
        <div className="library-collection">
          <div className="library-controls">
            <label className="search-control">
              <span className="sr-only">Search your words</span>
              <Icon name="search" size={20} />
              <input
                type="search"
                placeholder="Search your words"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
              {searchText ? (
                <button
                  type="button"
                  className="clear-search"
                  onClick={() => setSearchText("")}
                >
                  Clear
                </button>
              ) : null}
            </label>

            <GlassSelect
              label="Filter by language"
              hideLabel
              icon="globe"
              value={language}
              onChange={setLanguage}
              options={LANGUAGE_OPTIONS}
            />

            <GlassSelect
              label="Sort vocabulary"
              hideLabel
              icon="sort"
              value={sortOrder}
              onChange={setSortOrder}
              options={SORT_OPTIONS}
            />
          </div>

          <div
            className="word-list has-glass-selector"
            role="group"
            aria-label="Vocabulary words"
            aria-describedby="word-list-shortcuts"
            ref={wordListRef}
            onKeyDown={handleListKeyDown}
          >
            <div className="word-list-header" aria-hidden="true">
              <span>Word</span>
              <span>Language</span>
              <span>Notes</span>
              <span>Review</span>
            </div>

            <GlassSelector
              containerRef={wordListRef}
              activeKey={visibleSelectedEntry?.id ?? null}
            />

            {filteredEntries.map((entry) => {
              const isSelected = visibleSelectedEntry?.id === entry.id;

              return (
                <button
                  key={entry.id}
                  type="button"
                  className={isSelected ? "word-row selected" : "word-row"}
                  data-glass-row={entry.id}
                  aria-pressed={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => {
                    onSelect(entry);
                    setIsMoreOpen(false);
                  }}
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
                <h2>No words match that search</h2>
                <p>Try another term or clear the filters to see your library.</p>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => {
                    setSearchText("");
                    setLanguage("all");
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : null}
          </div>

          <p className="collection-count">
            <span>
              Showing {filteredEntries.length} of {entries.length} words
            </span>
            {filteredEntries.length > 0 ? (
              <span id="word-list-shortcuts" className="collection-shortcuts">
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
          <LiquidGlassSurface
            as="aside"
            id={`detail-${visibleSelectedEntry.id}`}
            className="library-detail"
            variant="sidebar"
            radius={30}
            intensity={1.08}
          >
            <div className="detail-heading-row">
              <div>
                <h2>{visibleSelectedEntry.word}</h2>
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

            <dl className="detail-definition-list">
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
              <div className="more-action-wrap">
                <button
                  type="button"
                  className="icon-button action-more"
                  aria-label="More actions"
                  aria-expanded={isMoreOpen}
                  onClick={() => setIsMoreOpen((isOpen) => !isOpen)}
                >
                  <Icon name="more" size={20} />
                </button>
                {isMoreOpen ? (
                  <div className="more-menu">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreOpen(false);
                        onDelete(visibleSelectedEntry);
                      }}
                    >
                      <Icon name="trash" size={17} />
                      Delete word
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </LiquidGlassSurface>
        ) : (
          <LiquidGlassSurface
            as="aside"
            id="library-detail-empty"
            className="library-detail empty-detail"
            variant="sidebar"
            radius={30}
            intensity={0.9}
          >
            <Icon name="book-open" size={34} />
            <h2>Your library is ready</h2>
            <p>Add your first word to begin building a practice queue.</p>
            <button type="button" className="primary-action" onClick={onAdd}>
              <Icon name="plus" size={18} />
              Add word
            </button>
          </LiquidGlassSurface>
        )}
      </section>
    </main>
  );
}

export default LibraryPage;

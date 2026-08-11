import { useId, useMemo, useRef, useState } from "react";
import Icon from "./Icon.jsx";

const MAX_SUGGESTIONS = 5;

function getTranslation(entry) {
  if (Array.isArray(entry?.translations) && entry.translations.length > 0) {
    return entry.translations.slice(0, 2).join(" · ");
  }

  return entry?.translation || "Saved in your library";
}

function getDirection(language) {
  return language === "Chinese" ? "ZH → EN" : "EN → ZH";
}

function WordSuggestionInput({ value, onChange, entries = [] }) {
  const listboxId = useId();
  const inputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const suggestions = useMemo(() => {
    const query = value.trim().toLocaleLowerCase();
    const seenWords = new Set();

    return entries
      .filter((entry) => {
        const word = String(entry?.word || "").trim();
        const normalizedWord = word.toLocaleLowerCase();

        if (!word || seenWords.has(normalizedWord)) {
          return false;
        }

        seenWords.add(normalizedWord);
        return !query || (normalizedWord.includes(query) && normalizedWord !== query);
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [entries, value]);

  const showSuggestions = isOpen && suggestions.length > 0;
  const resolvedActiveIndex = Math.min(activeIndex, suggestions.length - 1);
  const activeSuggestion = suggestions[resolvedActiveIndex] ?? null;

  function openSuggestions() {
    if (suggestions.length > 0) {
      setActiveIndex(0);
      setIsOpen(true);
    }
  }

  function selectSuggestion(entry) {
    onChange(entry.word);
    setIsOpen(false);
    setActiveIndex(0);
    inputRef.current?.focus();
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (!showSuggestions) {
        openSuggestions();
        return;
      }

      setActiveIndex((index) => (index + 1) % suggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (!showSuggestions) {
        openSuggestions();
        return;
      }

      setActiveIndex(
        (index) => (index - 1 + suggestions.length) % suggestions.length,
      );
      return;
    }

    if (event.key === "Enter" && showSuggestions && activeSuggestion) {
      event.preventDefault();
      selectSuggestion(activeSuggestion);
      return;
    }

    if (event.key === "Tab") {
      setIsOpen(false);
    }
  }

  return (
    <div className="form-field word-combobox-field">
      <label id={`${listboxId}-label`} htmlFor={`${listboxId}-input`}>
        Word
      </label>

      <div
        className="word-combobox"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsOpen(false);
          }
        }}
      >
        <input
          ref={inputRef}
          id={`${listboxId}-input`}
          name="vocabulary-entry"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls={listboxId}
          aria-activedescendant={
            showSuggestions ? `${listboxId}-option-${resolvedActiveIndex}` : undefined
          }
          autoComplete="off"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setActiveIndex(0);
            setIsOpen(true);
          }}
          onFocus={openSuggestions}
          onKeyDownCapture={(event) => {
            if (event.key === "Escape" && showSuggestions) {
              event.preventDefault();
              event.stopPropagation();
              setIsOpen(false);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Example: happy"
          data-autofocus
        />

        {showSuggestions ? (
          <div className="word-suggestion-popover">
            <div className="word-suggestion-caption">
              <span>{value.trim() ? "Matching vocabulary" : "Recent vocabulary"}</span>
              <span>{suggestions.length}</span>
            </div>

            <div id={listboxId} className="word-suggestion-list" role="listbox">
              {suggestions.map((entry, index) => {
                const isActive = index === resolvedActiveIndex;

                return (
                  <button
                    key={entry.id ?? entry.word}
                    id={`${listboxId}-option-${index}`}
                    type="button"
                    className={
                      isActive
                        ? "word-suggestion-option active"
                        : "word-suggestion-option"
                    }
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectSuggestion(entry)}
                  >
                    <span className="word-suggestion-copy">
                      <strong>{entry.word}</strong>
                      <span>{getTranslation(entry)}</span>
                    </span>
                    <span className="word-suggestion-direction">
                      {getDirection(entry.language)}
                    </span>
                    <Icon name="chevron-right" size={15} />
                  </button>
                );
              })}
            </div>

            <p className="word-suggestion-help">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> move
              </span>
              <span>
                <kbd>Enter</kbd> select
              </span>
              <span>
                <kbd>Esc</kbd> close
              </span>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default WordSuggestionInput;

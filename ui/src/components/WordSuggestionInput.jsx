import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import MotionRegion from "../motion/MotionRegion.jsx";
import Icon from "./Icon.jsx";
import InkField from "./InkField.jsx";

const MAX_SUGGESTIONS = 5;

function getTranslation(entry) {
  if (Array.isArray(entry?.translations) && entry.translations.length > 0) {
    return entry.translations.slice(0, 2).join(", ");
  }

  return entry?.translation || "Saved in your library";
}

function getDirection(language) {
  return language === "Chinese" ? "ZH → EN" : "EN → ZH";
}

function WordSuggestionInput({ value, onChange, entries = [] }) {
  const listboxId = useId();
  const inputRef = useRef(null);
  const markerRef = useRef(null);
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

  // One highlight glides to the active option. It is placed without moving
  // when the list opens, and glides from then on; the option it lands on is
  // kept in view as the arrow keys run down a long list.
  useLayoutEffect(() => {
    const marker = markerRef.current;
    const option = showSuggestions
      ? document.getElementById(`${listboxId}-option-${resolvedActiveIndex}`)
      : null;

    if (!marker || !option) {
      return undefined;
    }

    const list = option.parentElement;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    marker.style.height = `${option.offsetHeight}px`;
    marker.style.transform = `translateY(${top}px)`;

    // Scroll only the list, never the dialog or the page behind it.
    if (top < list.scrollTop) {
      list.scrollTop = top;
    } else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight;
    }

    if (marker.dataset.placed !== undefined) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      marker.dataset.placed = "";
    });
    return () => window.cancelAnimationFrame(frame);
  }, [listboxId, resolvedActiveIndex, showSuggestions, suggestions]);

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
        <InkField
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
          onFocus={() => {
            // The dialog focuses this field as it opens; an empty field
            // keeps the form clear until you type or press the down arrow.
            if (value.trim()) {
              openSuggestions();
            }
          }}
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

        <AnimatePresence>
          {showSuggestions ? (
            <MotionRegion key="suggestions" motionPreset="menu" className="word-suggestion-popover">
              <div className="word-suggestion-caption">
                <span>{value.trim() ? "Matching words" : "Your words"}</span>
                <span>{suggestions.length}</span>
              </div>

              <div id={listboxId} className="word-suggestion-list" role="listbox">
                <span ref={markerRef} className="word-suggestion-marker" aria-hidden="true" />
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
            </MotionRegion>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default WordSuggestionInput;

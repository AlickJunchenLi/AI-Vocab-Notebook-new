import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import LiquidGlassSurface from "../motion/MotionSurface.jsx";
import "../studyNotebook.css";

const ASSESSMENTS = [
  { value: "again", label: "Again", icon: "rotate-ccw" },
  { value: "hard", label: "Hard", icon: "frown" },
  { value: "good", label: "Good", icon: "smile" },
  { value: "easy", label: "Easy", icon: "check" },
];

function getTranslations(entry) {
  if (Array.isArray(entry?.translations) && entry.translations.length > 0) {
    return entry.translations.join(", ");
  }

  if (typeof entry?.translation === "string" && entry.translation.trim()) {
    return entry.translation;
  }

  return "No translation has been added yet.";
}

function getDefinition(entry) {
  return entry?.definition || entry?.notes || "No definition has been added yet.";
}

function PracticePage({ entries, onPracticeEntry }) {
  const sessionEntries = Array.isArray(entries) ? entries : [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [sessionResults, setSessionResults] = useState([]);
  const revealButtonRef = useRef(null);
  const resetButtonRef = useRef(null);
  const shouldRestoreFocus = useRef(false);

  const hasEntries = sessionEntries.length > 0;
  const isComplete = hasEntries && currentIndex >= sessionEntries.length;
  const currentEntry = isComplete ? null : sessionEntries[currentIndex];
  const confidentResponses = sessionResults.filter(
    (result) => result.assessment === "good" || result.assessment === "easy"
  ).length;

  const handleAssessment = useCallback((assessment) => {
    if (!currentEntry || !isRevealed) {
      return;
    }

    if (typeof onPracticeEntry === "function") {
      onPracticeEntry(currentEntry, assessment);
    }

    shouldRestoreFocus.current = true;
    setSessionResults((previousResults) => [
      ...previousResults,
      { entryId: currentEntry.id, assessment },
    ]);
    setCurrentIndex((previousIndex) => previousIndex + 1);
    setIsRevealed(false);
  }, [currentEntry, isRevealed, onPracticeEntry]);

  useEffect(() => {
    if (shouldRestoreFocus.current) {
      const nextControl = isComplete ? resetButtonRef.current : revealButtonRef.current;
      nextControl?.focus({ preventScroll: true });
      shouldRestoreFocus.current = false;
    }
  }, [currentIndex, isComplete]);

  useEffect(() => {
    function handleShortcut(event) {
      if (
        !currentEntry || event.repeat || event.altKey || event.ctrlKey || event.metaKey ||
        document.querySelector('[aria-modal="true"]:not([inert]), [role="dialog"]:not([inert]), dialog[open]') ||
        event.target.closest?.('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }

      if (event.code === "Space" && !event.target.closest?.("button, a")) {
        event.preventDefault();
        setIsRevealed(true);
      } else if (isRevealed && /^[1-4]$/.test(event.key)) {
        event.preventDefault();
        handleAssessment(ASSESSMENTS[Number(event.key) - 1].value);
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [currentEntry, isRevealed, handleAssessment]);

  function handleReset() {
    shouldRestoreFocus.current = true;
    setCurrentIndex(0);
    setIsRevealed(false);
    setSessionResults([]);
  }

  if (!hasEntries) {
    return (
      <main className="page practice-page" aria-labelledby="practice-page-title">
        <header className="page-header">
          <h1 id="practice-page-title">Practice</h1>
          <p>Recall each word&apos;s meaning, then rate how well you knew it.</p>
        </header>

        <LiquidGlassSurface
          as="section"
          id="practice-empty-state"
          className="practice-empty-state"
          variant="panel"
          radius={20}
          aria-labelledby="practice-empty-title"
        >
          <Icon name="book-open" size={28} className="practice-empty-icon" />
          <h2 id="practice-empty-title">Nothing to practice yet</h2>
          <p>Add a word to your library, then come back to practice it.</p>
          <a className="text-link" href="#/library">
            Open library <Icon name="arrow-up-right" size={15} />
          </a>
        </LiquidGlassSurface>
      </main>
    );
  }

  if (isComplete) {
    const confidenceRate = Math.round(
      (confidentResponses / Math.max(sessionResults.length, 1)) * 100
    );

    return (
      <main className="page practice-page" aria-labelledby="practice-complete-title">
        <header className="page-header">
          <h1 id="practice-complete-title">Session complete</h1>
          <p>
            You reviewed {sessionResults.length} {sessionResults.length === 1 ? "word" : "words"}.
          </p>
        </header>

        <LiquidGlassSurface
          as="section"
          id="practice-completion-card"
          className="practice-completion-card"
          variant="panel"
          radius={20}
          aria-label="Practice session results"
        >
          <span className="practice-completion-icon" aria-hidden="true">
            <Icon name="check" size={24} weight="bold" />
          </span>

          <dl className="practice-completion-stats">
            <div className="practice-completion-stat">
              <dt>Reviewed</dt>
              <dd>{sessionResults.length}</dd>
            </div>
            <div className="practice-completion-stat">
              <dt>Good or easy</dt>
              <dd>{confidentResponses}</dd>
            </div>
            <div className="practice-completion-stat">
              <dt>Confidence</dt>
              <dd>{confidenceRate}%</dd>
            </div>
          </dl>

          <button
            id="practice-reset-button"
            ref={resetButtonRef}
            type="button"
            className="practice-reset-button"
            onClick={handleReset}
          >
            <Icon name="rotate-ccw" size={18} />
            Practice again
          </button>
        </LiquidGlassSurface>
      </main>
    );
  }

  const answerId = `practice-answer-${String(currentEntry.id ?? currentIndex)}`;

  return (
    <main className="page practice-page" aria-labelledby="practice-page-title">
      <header className="page-header practice-header">
        <div>
          <h1 id="practice-page-title">Practice</h1>
          <p>Recall each word&apos;s meaning, then rate how well you knew it.</p>
        </div>

        <div className="practice-progress-group" aria-live="polite">
          <span className="practice-progress-label">
            Card {currentIndex + 1} of {sessionEntries.length}
          </span>
          <div
            className="practice-progress-bar"
            role="progressbar"
            aria-valuenow={currentIndex}
            aria-valuemin={0}
            aria-valuemax={sessionEntries.length}
            aria-label="Words reviewed"
            aria-valuetext={`${currentIndex} of ${sessionEntries.length} reviewed`}
          >
            <span style={{ transform: `scaleX(${currentIndex / sessionEntries.length})` }} />
          </div>
        </div>
      </header>

      <div className="practice-layout">
        <div className="practice-stage" aria-live="polite">
          <LiquidGlassSurface
            key={currentEntry.id ?? currentIndex}
            as="article"
            id="practice-prompt-card"
            motionPreset="step"
            className="practice-prompt-card"
            variant="panel"
            radius={20}
            aria-labelledby="practice-current-word"
          >
            <span className="practice-card-language">{currentEntry.language}</span>
            <h2 id="practice-current-word" className="practice-word hand">
              {currentEntry.word}
            </h2>
            {currentEntry.pronunciation ? (
              <p className="practice-pronunciation">{currentEntry.pronunciation}</p>
            ) : null}
            <div className="practice-prompt-action">
              <p>Recall the meaning before you reveal it.</p>
              <button
                id="practice-reveal-button"
                ref={revealButtonRef}
                type="button"
                className="practice-reveal-button"
                aria-expanded={isRevealed}
                aria-controls={answerId}
                aria-keyshortcuts="Space"
                onClick={() => setIsRevealed(true)}
              >
                <Icon name="eye" size={18} />
                {isRevealed ? "Meaning shown" : "Show meaning"}
                <kbd aria-hidden="true">Space</kbd>
              </button>
            </div>
          </LiquidGlassSurface>

          {isRevealed ? (
            <LiquidGlassSurface
              as="section"
              id={answerId}
              className="practice-answer-card"
              variant="panel"
              radius={20}
              aria-labelledby="practice-answer-title"
            >
              <div className="practice-answer-heading">
                <p className="card-label">Meaning</p>
                <h2 id="practice-answer-title">{getTranslations(currentEntry)}</h2>
              </div>

              <dl className="practice-answer-details">
                <div className="practice-answer-detail">
                  <dt>Definition</dt>
                  <dd>{getDefinition(currentEntry)}</dd>
                </div>
                <div className="practice-answer-detail">
                  <dt>Example</dt>
                  <dd>
                    {currentEntry.example || "No example has been added yet."}
                  </dd>
                </div>
              </dl>

              <fieldset className="practice-assessment-group">
                <legend>How well did you remember it?</legend>
                <div className="practice-assessment-buttons">
                  {ASSESSMENTS.map((assessment, index) => (
                    <button
                      key={assessment.value}
                      type="button"
                      className={`practice-assessment-button practice-assessment-${assessment.value}`}
                      aria-label={`Rate ${currentEntry.word} as ${assessment.label}`}
                      aria-keyshortcuts={String(index + 1)}
                      title={`${assessment.label} (${index + 1})`}
                      onClick={() => handleAssessment(assessment.value)}
                    >
                      <Icon name={assessment.icon} size={18} />
                      <span>{assessment.label}</span>
                      <kbd aria-hidden="true">{index + 1}</kbd>
                    </button>
                  ))}
                </div>
              </fieldset>
            </LiquidGlassSurface>
          ) : null}
        </div>

        <aside
          id="practice-session-panel"
          className="practice-session-panel"
          aria-labelledby="practice-session-title"
        >
          <h2 id="practice-session-title">
            This session <span>{sessionEntries.length}</span>
          </h2>

          <ol className="practice-session-list">
            {sessionEntries.map((entry, index) => {
              const isCurrent = index === currentIndex;
              const isReviewed = index < currentIndex;
              const itemClassName = [
                "practice-session-item",
                isCurrent ? "practice-session-item-current" : "",
                isReviewed ? "practice-session-item-reviewed" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <li
                  key={entry.id ?? `${entry.word}-${index}`}
                  className={itemClassName}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  <span className="practice-session-number">
                    {isReviewed ? <Icon name="check" size={15} weight="bold" /> : index + 1}
                  </span>
                  <span className="practice-session-word-group">
                    <strong className="hand">{entry.word}</strong>
                    <span>{entry.language}</span>
                  </span>
                  <span className="practice-session-status">
                    {isCurrent ? "Now" : isReviewed ? "Done" : ""}
                  </span>
                </li>
              );
            })}
          </ol>

          <p className="practice-session-keys">
            <span><kbd>Space</kbd> show meaning</span>
            <span><kbd>1</kbd> to <kbd>4</kbd> rate</span>
          </p>
        </aside>
      </div>
    </main>
  );
}

export default PracticePage;

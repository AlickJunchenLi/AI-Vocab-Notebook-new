import { useState } from "react";
import Icon from "../components/Icon.jsx";
import LiquidGlassSurface from "../glass/LiquidGlassSurface.jsx";

const ASSESSMENTS = [
  { value: "again", label: "Again", icon: "rotate-ccw" },
  { value: "hard", label: "Hard", icon: "frown" },
  { value: "good", label: "Good", icon: "smile" },
  { value: "easy", label: "Easy", icon: "check" },
];

function getTranslations(entry) {
  if (Array.isArray(entry?.translations) && entry.translations.length > 0) {
    return entry.translations.join(" · ");
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

  const hasEntries = sessionEntries.length > 0;
  const isComplete = hasEntries && currentIndex >= sessionEntries.length;
  const currentEntry = isComplete ? null : sessionEntries[currentIndex];
  const confidentResponses = sessionResults.filter(
    (result) => result.assessment === "good" || result.assessment === "easy"
  ).length;

  function handleAssessment(assessment) {
    if (!currentEntry) {
      return;
    }

    if (typeof onPracticeEntry === "function") {
      onPracticeEntry(currentEntry, assessment);
    }

    setSessionResults((previousResults) => [
      ...previousResults,
      { entryId: currentEntry.id, assessment },
    ]);
    setCurrentIndex((previousIndex) => previousIndex + 1);
    setIsRevealed(false);
  }

  function handleReset() {
    setCurrentIndex(0);
    setIsRevealed(false);
    setSessionResults([]);
  }

  if (!hasEntries) {
    return (
      <main className="practice-page" aria-labelledby="practice-page-title">
        <header className="practice-page-header">
          <h1 id="practice-page-title">Practice what matters</h1>
          <p className="practice-page-description">
            A short session built from the words ready for review.
          </p>
        </header>

        <LiquidGlassSurface
          as="section"
          id="practice-empty-state"
          className="practice-empty-state"
          variant="panel"
          radius={30}
          intensity={1.02}
          aria-labelledby="practice-empty-title"
        >
          <Icon name="book-open" size={30} className="practice-empty-icon" />
          <h2 id="practice-empty-title">Your practice queue is empty</h2>
          <p>Add words to the library, then return here for a focused review.</p>
        </LiquidGlassSurface>
      </main>
    );
  }

  if (isComplete) {
    const confidenceRate = Math.round(
      (confidentResponses / Math.max(sessionResults.length, 1)) * 100
    );

    return (
      <main className="practice-page" aria-labelledby="practice-complete-title">
        <header className="practice-page-header practice-page-header-complete">
          <h1 id="practice-complete-title">Nice work. That round is done.</h1>
          <p className="practice-page-description">
            You reviewed every word in this session.
          </p>
        </header>

        <LiquidGlassSurface
          as="section"
          id="practice-completion-card"
          className="practice-completion-card"
          variant="panel"
          radius={32}
          intensity={1.14}
          aria-label="Practice session results"
        >
          <span className="practice-completion-icon" aria-hidden="true">
            <Icon name="check" size={30} />
          </span>

          <dl className="practice-completion-stats">
            <div className="practice-completion-stat">
              <dt>Words reviewed</dt>
              <dd>{sessionResults.length}</dd>
            </div>
            <div className="practice-completion-stat">
              <dt>Confident responses</dt>
              <dd>{confidentResponses}</dd>
            </div>
            <div className="practice-completion-stat">
              <dt>Confidence rate</dt>
              <dd>{confidenceRate}%</dd>
            </div>
          </dl>

          <LiquidGlassSurface
            as="button"
            id="practice-reset-button"
            type="button"
            className="practice-reset-button"
            variant="button"
            radius={18}
            intensity={1.08}
            onClick={handleReset}
          >
            <Icon name="rotate-ccw" size={18} />
            Practice again
          </LiquidGlassSurface>
        </LiquidGlassSurface>
      </main>
    );
  }

  const answerId = `practice-answer-${String(currentEntry.id ?? currentIndex)}`;

  return (
    <main className="practice-page" aria-labelledby="practice-page-title">
      <header className="practice-page-header">
        <div className="practice-page-heading-copy">
          <h1 id="practice-page-title">Practice what matters</h1>
          <p className="practice-page-description">
            A short session built from the words ready for review.
          </p>
        </div>

        <div className="practice-progress-group" aria-live="polite">
          <progress
            className="practice-progress-bar"
            value={currentIndex + 1}
            max={sessionEntries.length}
          >
            {currentIndex + 1} of {sessionEntries.length}
          </progress>
          <span className="practice-progress-label">
            {currentIndex + 1} of {sessionEntries.length}
          </span>
        </div>
      </header>

      <div className="practice-layout">
        <div className="practice-stage" aria-live="polite">
          <LiquidGlassSurface
            as="article"
            id="practice-prompt-card"
            className="practice-prompt-card"
            variant="panel"
            radius={34}
            intensity={1.2}
            aria-labelledby="practice-current-word"
          >
            <h2 id="practice-current-word" className="practice-word">
              {currentEntry.word}
            </h2>
            {currentEntry.pronunciation ? (
              <p className="practice-pronunciation">{currentEntry.pronunciation}</p>
            ) : null}
            <p className="practice-language">{currentEntry.language}</p>

            <div className="practice-prompt-action">
              <p>Do you remember this word?</p>
              <LiquidGlassSurface
                as="button"
                id="practice-reveal-button"
                type="button"
                className="practice-reveal-button"
                variant="button"
                radius={18}
                intensity={1.1}
                aria-expanded={isRevealed}
                aria-controls={answerId}
                onClick={() => setIsRevealed(true)}
              >
                <Icon name="eye" size={18} />
                {isRevealed ? "Meaning revealed" : "Reveal meaning"}
              </LiquidGlassSurface>
            </div>
          </LiquidGlassSurface>

          {isRevealed ? (
            <LiquidGlassSurface
              as="section"
              id={answerId}
              className="practice-answer-card"
              variant="panel"
              radius={34}
              intensity={1.16}
              aria-labelledby="practice-answer-title"
            >
              <div className="practice-answer-heading">
                <p className="practice-answer-label">Translation</p>
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
                  {ASSESSMENTS.map((assessment) => (
                    <button
                      key={assessment.value}
                      type="button"
                      className={`practice-assessment-button practice-assessment-${assessment.value}`}
                      aria-label={`Rate ${currentEntry.word} as ${assessment.label}`}
                      onClick={() => handleAssessment(assessment.value)}
                    >
                      <Icon name={assessment.icon} size={18} />
                      <span>{assessment.label}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            </LiquidGlassSurface>
          ) : null}
        </div>

        <LiquidGlassSurface
          as="aside"
          id="practice-session-panel"
          className="practice-session-panel"
          variant="sidebar"
          radius={28}
          intensity={0.98}
          aria-labelledby="practice-session-title"
        >
          <header className="practice-session-header">
            <Icon name="clock" size={18} />
            <h2 id="practice-session-title">Session</h2>
          </header>

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
                  <span className="practice-session-number">{index + 1}</span>
                  <span className="practice-session-word-group">
                    <strong>{entry.word}</strong>
                    <span>{entry.language}</span>
                  </span>
                  <span className="practice-session-status">
                    {isCurrent ? "Now" : isReviewed ? "Reviewed" : "Due"}
                  </span>
                </li>
              );
            })}
          </ol>

          <p className="practice-session-count">
            {sessionEntries.length} {sessionEntries.length === 1 ? "word" : "words"} in
            this session
          </p>
        </LiquidGlassSurface>
      </div>
    </main>
  );
}

export default PracticePage;

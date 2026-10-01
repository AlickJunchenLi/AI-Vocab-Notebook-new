import { AnimatePresence } from "motion/react";
import Icon from "../components/Icon.jsx";
import DailyNote from "../components/DailyNote.jsx";
import TourInvite from "../tour/TourInvite.jsx";
import LiquidGlassSurface from "../motion/MotionSurface.jsx";
import TodayHeader from "../today/TodayHeader.jsx";
import "../todayNotebook.css";

const DAYS_IN_WEEK = 7;
const translation = (entry) => entry?.translations?.slice(0, 2).join(", ") || entry?.translation || "No translation yet";
const isDue = (entry) => /due|review again/i.test(entry.dueLabel || "Due today");

function speakWord(entry) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(entry.word);
  utterance.lang = entry.language === "Chinese" ? "zh-CN" : "en-US";
  window.speechSynthesis.speak(utterance);
}

function dayOfYear(date) {
  return Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86_400_000);
}

export default function TodayPage({
  entries,
  onStartReview,
  onSelectEntry,
  onAdd,
  showTourInvite = false,
  onStartTour,
  onDismissTour,
  readerName = "",
  welcome = false,
  onWelcomeDone,
}) {
  const words = Array.isArray(entries) ? entries : [];
  const now = new Date();
  const todayIndex = (now.getDay() + 6) % 7;
  const due = words.filter(isDue);
  const activity = Array.from({ length: DAYS_IN_WEEK }, (_, index) => words.reduce((total, entry) => total + (Number(entry.weeklyReviews?.[index]) || 0), 0));
  let streak = 0;
  for (let offset = 0; offset < DAYS_IN_WEEK && activity[(todayIndex - offset + DAYS_IN_WEEK) % DAYS_IN_WEEK] > 0; offset += 1) streak += 1;
  // A different word each day, stable for the whole day.
  const featured = words.length ? words[dayOfYear(now) % words.length] : null;
  // Words never reviewed come first; then the lowest recorded recall.
  const weakest = [...words].sort((a, b) => (a.recallRate ?? -1) - (b.recallRate ?? -1)).slice(0, 3);
  const recent = [...words].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 4);
  const mastered = words.filter((entry) => entry.mastery === "mastered").length;
  const languages = new Set(words.map((entry) => entry.language)).size;
  const minutes = Math.max(1, Math.ceil(due.length * 0.4));

  return (
    <main className="page today-page" aria-labelledby="today-page-title" data-welcome={welcome || undefined}>
      <TodayHeader
        name={readerName}
        wordCount={words.length}
        dueCount={due.length}
        mastered={mastered}
        languages={languages}
        activity={activity}
        todayIndex={todayIndex}
        streak={streak}
        welcome={welcome}
        onWelcomeDone={onWelcomeDone}
      />

      {/* The rest of the page, which the day's welcome brings in as one. */}
      <div className="today-body">
        <AnimatePresence>
          {showTourInvite ? (
            <TourInvite key="tour-invite" onStart={onStartTour} onDismiss={onDismissTour} />
          ) : null}
        </AnimatePresence>

        {words.length ? (
          <div className="today-spread">
            <LiquidGlassSurface
              as="section"
              id="today-review"
              className="today-review"
              variant="panel"
              radius={20}
              aria-labelledby="today-review-title"
            >
              <div className="today-review-head">
                <h2 id="today-review-title">Review</h2>
                {due.length ? (
                  <p>
                    <strong>{due.length}</strong> {due.length === 1 ? "word is" : "words are"} due today.
                    {" "}About {minutes} {minutes === 1 ? "minute" : "minutes"}.
                  </p>
                ) : (
                  <p>Nothing is due. New words are due on the day you add them.</p>
                )}
                <button
                  className="primary-action"
                  type="button"
                  onClick={() => (due.length ? onStartReview(due) : onAdd())}
                >
                  {due.length ? "Start review" : "Add word"}
                  <Icon name={due.length ? "arrow-up-right" : "plus"} size={18} />
                </button>
              </div>

              <div className="today-weakest">
                <h3>Weakest words</h3>
                <ul>
                  {weakest.map((entry) => (
                    <li key={entry.id}>
                      <button type="button" onClick={() => onSelectEntry(entry)} aria-label={`Open ${entry.word} in the library`}>
                        <span className="today-weakest-word">
                          <strong className="hand">{entry.word}</strong>
                          <span>{translation(entry)}</span>
                        </span>
                        <span className="today-recall">
                          {entry.recallRate == null ? "New" : <><strong>{entry.recallRate}%</strong> recall</>}
                        </span>
                        <Icon name="chevron-right" size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </LiquidGlassSurface>

            <LiquidGlassSurface
              as="aside"
              id="today-featured"
              delay={0.05}
              className="today-featured"
              variant="card"
              radius={20}
              aria-labelledby="today-featured-title"
            >
              <h2 id="today-featured-title" className="card-label">Word of the day</h2>
              <button type="button" className="today-featured-word hand" onClick={() => onSelectEntry(featured)}>
                {featured.word}
              </button>
              <div className="today-featured-sound">
                <span>{featured.pronunciation}</span>
                <button type="button" className="icon-button" aria-label={`Hear ${featured.word}`} onClick={() => speakWord(featured)}>
                  <Icon name="volume" size={18} />
                </button>
              </div>
              <p className="today-featured-translation">{translation(featured)}</p>
              {featured.example ? <p className="today-featured-example">{featured.example}</p> : null}
              <button type="button" className="text-link" onClick={() => onSelectEntry(featured)}>
                Open in library <Icon name="arrow-up-right" size={15} />
              </button>
            </LiquidGlassSurface>
          </div>
        ) : (
          <LiquidGlassSurface as="section" id="today-empty" className="today-empty" variant="panel" radius={20} aria-labelledby="today-empty-title">
            <h2 id="today-empty-title">Your notebook is empty</h2>
            <p>Add a word you want to remember. It will be ready to review today.</p>
            <button type="button" className="primary-action" onClick={onAdd}>
              Add word <Icon name="plus" size={18} />
            </button>
          </LiquidGlassSurface>
        )}

        <div className="today-lower">
          <DailyNote />
        </div>

        {recent.length > 0 ? (
          <section className="today-recent" aria-labelledby="today-recent-title">
            <div className="section-head">
              <h2 id="today-recent-title">Recently added</h2>
              <button type="button" className="text-link" onClick={() => onSelectEntry(null)}>
                Open library <Icon name="chevron-right" size={15} />
              </button>
            </div>
            <div className="today-recent-grid">
              {recent.map((entry, index) => (
                <LiquidGlassSurface
                  reveal
                  delay={index * 0.04}
                  key={entry.id}
                  as="button"
                  id={`today-recent-${entry.id}`}
                  type="button"
                  className="today-recent-card"
                  variant="card"
                  radius={16}
                  intensity={0.85}
                  onClick={() => onSelectEntry(entry)}
                  aria-label={`Open ${entry.word} in the library`}
                >
                  <strong className="hand">{entry.word}</strong>
                  <span>{translation(entry)}</span>
                  <small>{entry.language}</small>
                </LiquidGlassSurface>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

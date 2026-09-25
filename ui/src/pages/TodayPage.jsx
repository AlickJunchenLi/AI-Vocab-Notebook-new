import Icon from "../components/Icon.jsx";
import DailyNote from "../components/DailyNote.jsx";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const translation = (entry) => entry?.translations?.slice(0, 2).join(" · ") || entry?.translation || "Translation not added";
const isDue = (entry) => /due|review again/i.test(entry.dueLabel || "Due today");

function speakWord(entry) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(entry.word);
  utterance.lang = entry.language === "Chinese" ? "zh-CN" : "en-US";
  window.speechSynthesis.speak(utterance);
}

export default function TodayPage({ entries, onStartReview, onSelectEntry, onAdd }) {
  const words = Array.isArray(entries) ? entries : [];
  const now = new Date();
  const todayIndex = (now.getDay() + 6) % 7;
  const due = words.filter(isDue);
  const activity = DAYS.map((_, index) => words.reduce((total, entry) => total + (Number(entry.weeklyReviews?.[index]) || 0), 0));
  let streak = 0;
  for (let offset = 0; offset < 7 && activity[(todayIndex - offset + 7) % 7] > 0; offset += 1) streak += 1;
  const featured = words.find((entry) => entry.word === "lucid") ?? words[0];
  const attention = [...words].sort((a, b) => (a.recallRate ?? 100) - (b.recallRate ?? 100)).slice(0, 3);
  const recent = [...words].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 4);
  const greeting = now.getHours() < 12 ? "Good morning." : now.getHours() < 18 ? "Good afternoon." : "Good evening.";
  const date = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(now);

  return (
    <main className="page today-page paper-today" aria-labelledby="today-page-title">
      <header className="journal-heading">
        <div><p className="journal-kicker">A little space to learn.</p><h1 id="today-page-title">{greeting}</h1></div>
        <div className="journal-date"><span>Today is</span><time dateTime={now.toLocaleDateString("en-CA")}>{date}</time></div>
      </header>
      <div className="journal-tally" aria-label="Your vocabulary at a glance">
        <span><strong>{words.length}</strong> words collected</span>
        <span><strong>{words.filter((entry) => entry.mastery === "mastered").length}</strong> made your own</span>
        <span><strong>{new Set(words.map((entry) => entry.language)).size}</strong> languages</span>
      </div>

      {words.length ? (
        <div className="journal-spread">
          <section className="journal-review" aria-labelledby="today-due-title">
            <div className="journal-section-heading"><h2 id="today-due-title">A little practice</h2><span className="handwritten-aside">a few minutes is enough</span></div>
            <p className="journal-review-intro">{due.length ? <><span className="ink-circle">{due.length}</span> {due.length === 1 ? "word is" : "words are"} ready for another look.</> : "All caught up. A good place to leave the bookmark."}</p>
            <button className="primary-action ink-button" type="button" onClick={() => due.length ? onStartReview(due) : onAdd}>
              {due.length ? "Start review" : "Add word"}<Icon name="arrow-up-right" size={18} />
            </button>
            <div className="journal-word-list">
              <h3>Worth another look</h3>
              {attention.map((entry, index) => (
                <button type="button" key={entry.id} onClick={() => onSelectEntry(entry)} aria-label={`Open ${entry.word} in the library`}>
                  <span className="pencil-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="journal-word"><strong>{entry.word}</strong><span>{translation(entry)}</span></span>
                  <span className="journal-word-hint">{entry.mastery === "mastered" ? "remembered" : "keep practicing"}</span>
                  <Icon name="chevron-right" size={16} />
                </button>
              ))}
            </div>
          </section>
          <aside className="taped-word" aria-labelledby="today-featured-title">
            <span className="paper-tape" aria-hidden="true" />
            <h2 id="today-featured-title">A word to keep</h2>
            <button type="button" className="taped-word-title" onClick={() => onSelectEntry(featured)}>{featured.word}</button>
            <div className="taped-pronunciation"><span>{featured.pronunciation}</span><button type="button" className="icon-button" aria-label={`Hear ${featured.word}`} onClick={() => speakWord(featured)}><Icon name="volume" size={18} /></button></div>
            <p className="taped-translation">{translation(featured)}</p>
            <p className="taped-example">{featured.example || featured.definition || "Add an example when you come back to this word."}</p>
            <button type="button" className="paper-link" onClick={() => onSelectEntry(featured)}>Open this page <Icon name="arrow-up-right" size={15} /></button>
          </aside>
        </div>
      ) : (
        <section className="journal-empty"><Icon name="book-open" size={32} /><h2>A fresh notebook.</h2><p>Start with a word you want to remember.</p><button type="button" className="primary-action" onClick={onAdd}>Add your first word <Icon name="edit" size={18} /></button></section>
      )}

      <div className="journal-bottom-spread">
        <DailyNote />
        <section className="journal-rhythm" aria-labelledby="today-streak-title">
          <div className="journal-section-heading"><h2 id="today-streak-title">One day at a time</h2><Icon name="calendar" size={18} /></div>
          <p><strong>{streak}</strong> {streak === 1 ? "day" : "days"} in your current streak</p>
          <ol className="journal-week" aria-label="Reviews this week">
            {DAYS.map((day, index) => <li key={index} className={index === todayIndex ? "is-today" : ""} aria-label={`${DAY_NAMES[index]}: ${activity[index]} reviews${index === todayIndex ? ", today" : ""}`}><span>{day}</span><span className={activity[index] ? "day-check is-checked" : "day-check"}>{activity[index] ? <Icon name="check" size={21} /> : null}</span></li>)}
          </ol>
          <p className="rhythm-note">{activity.reduce((sum, count) => sum + count, 0)} reviews this week</p>
        </section>
      </div>

      {recent.length > 0 && <section className="journal-recent" aria-labelledby="today-recent-title">
        <div className="journal-section-heading"><h2 id="today-recent-title">The latest pages</h2><button type="button" className="paper-link" onClick={() => onSelectEntry(null)}>Open library <Icon name="chevron-right" size={15} /></button></div>
        <div className="journal-recent-list">{recent.map((entry) => <button key={entry.id} type="button" onClick={() => onSelectEntry(entry)} aria-label={`Open recent word ${entry.word}`}><strong>{entry.word}</strong><span>{translation(entry)}</span><small>{entry.language}</small></button>)}</div>
      </section>}
    </main>
  );
}

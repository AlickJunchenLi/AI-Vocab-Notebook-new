import Icon from "../components/Icon.jsx";
import LiquidGlassSurface from "../glass/LiquidGlassSurface.jsx";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getPrimaryTranslation(entry) {
  if (Array.isArray(entry?.translations) && entry.translations.length > 0) {
    return entry.translations.slice(0, 2).join(" · ");
  }

  return entry?.translation || "Translation not added";
}

function getLanguageDirection(language) {
  return language === "Chinese" ? "ZH → EN" : "EN → ZH";
}

function isDue(entry) {
  const dueLabel = String(entry?.dueLabel || "Due today").toLowerCase();
  return dueLabel.includes("due") || dueLabel.includes("review again");
}

function getGreeting(hour) {
  if (hour < 12) {
    return "Good morning.";
  }

  if (hour < 18) {
    return "Good afternoon.";
  }

  return "Good evening.";
}

function formatToday(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function getWeeklyActivity(entries) {
  return WEEKDAYS.map((_, dayIndex) =>
    entries.reduce((total, entry) => {
      const reviews = Number(entry?.weeklyReviews?.[dayIndex]);
      return total + (Number.isFinite(reviews) ? reviews : 0);
    }, 0),
  );
}

function getCurrentStreak(activity, todayIndex) {
  let streak = 0;

  for (let offset = 0; offset < activity.length; offset += 1) {
    const index = (todayIndex - offset + activity.length) % activity.length;

    if (activity[index] <= 0) {
      break;
    }

    streak += 1;
  }

  return streak;
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

function RecentWordCard({ entry, onSelect }) {
  return (
    <LiquidGlassSurface
      as="button"
      id={`today-recent-${entry.id}`}
      type="button"
      className="today-recent-card"
      variant="card"
      radius={17}
      intensity={0.82}
      onClick={() => onSelect(entry)}
      aria-label={`Open ${entry.word} in the library`}
    >
      <span className="today-recent-card-heading">
        <strong>{entry.word}</strong>
        <span className="today-language-direction">
          {getLanguageDirection(entry.language)}
        </span>
      </span>
      <span className="today-recent-translation">
        {getPrimaryTranslation(entry)}
      </span>
      <span className="today-recent-meta">
        {entry.lastReviewedLabel ?? "New word"}
        <Icon name="chevron-right" size={15} />
      </span>
    </LiquidGlassSurface>
  );
}

function TodayPage({ entries, onStartReview, onSelectEntry, onAdd }) {
  const vocabularyEntries = Array.isArray(entries) ? entries : [];
  const now = new Date();
  const dueEntries = vocabularyEntries.filter(isDue);
  const weeklyActivity = getWeeklyActivity(vocabularyEntries);
  const todayIndex = (now.getDay() + 6) % 7;
  const streak = getCurrentStreak(weeklyActivity, todayIndex);
  const weeklyReviewCount = weeklyActivity.reduce((total, count) => total + count, 0);
  const masteredCount = vocabularyEntries.filter((entry) => entry.mastery === "mastered").length;
  const languageCount = new Set(vocabularyEntries.map((entry) => entry.language)).size;
  const needsAttention = [...vocabularyEntries]
    .sort(
      (first, second) =>
        Number(first.recallRate ?? 100) - Number(second.recallRate ?? 100),
    )
    .slice(0, 3);
  const featuredEntry =
    vocabularyEntries.find((entry) => entry.word === "lucid") ??
    vocabularyEntries[now.getDate() % Math.max(vocabularyEntries.length, 1)] ??
    null;
  const recentEntries = [...vocabularyEntries]
    .sort((first, second) => Number(second.id) - Number(first.id))
    .slice(0, 4);

  if (vocabularyEntries.length === 0) {
    return (
      <main className="page today-page" aria-labelledby="today-page-title">
        <header className="page-heading today-heading">
          <h1 id="today-page-title">{getGreeting(now.getHours())}</h1>
          <time dateTime={now.toISOString().slice(0, 10)}>{formatToday(now)}</time>
        </header>

        <LiquidGlassSurface
          as="section"
          id="today-empty-state"
          className="today-empty-state"
          variant="panel"
          radius={30}
          intensity={1.02}
          aria-labelledby="today-empty-title"
        >
          <span className="today-empty-icon" aria-hidden="true">
            <Icon name="book-open" size={30} />
          </span>
          <h2 id="today-empty-title">Add your first word</h2>
          <p>Your daily review, focus words, and learning rhythm will appear here.</p>
          <button type="button" className="primary-action" onClick={onAdd}>
            <Icon name="plus" size={18} />
            Add word
          </button>
        </LiquidGlassSurface>
      </main>
    );
  }

  return (
    <main className="page today-page" aria-labelledby="today-page-title">
      <header className="page-heading today-heading">
        <div>
          <span className="page-eyebrow"><span /> YOUR DAILY CHAPTER</span>
          <h1 id="today-page-title">{getGreeting(now.getHours())}</h1>
          <p>A few words today. A little more of the world tomorrow.</p>
        </div>
        <time dateTime={now.toLocaleDateString("en-CA")}><Icon name="calendar" size={17} />{formatToday(now)}</time>
      </header>

      <div className="today-stat-strip" aria-label="Your vocabulary at a glance">
        <span><Icon name="book-open" size={17} /><strong>{vocabularyEntries.length}</strong> words collected</span>
        <span><Icon name="globe" size={17} /><strong>{languageCount}</strong> {languageCount === 1 ? "language" : "languages"} explored</span>
        <span><Icon name="check" size={17} /><strong>{masteredCount}</strong> mastered</span>
      </div>

      <div className="today-overview-grid">
        <LiquidGlassSurface
          as="section"
          id="today-due-card"
          className="today-due-card"
          variant="panel"
          radius={25}
          intensity={1.08}
          aria-labelledby="today-due-title"
        >
          <div className="today-due-copy">
            <span className="review-eyebrow"><span /> {dueEntries.length > 0 ? "A MOMENT FOR YOUR MIND" : "LOOK AT YOU GROW"}</span>
            <h2 id="today-due-title">
              {dueEntries.length === 0 ? <>All caught up.<br /><em>Nicely done.</em></> : <>Small steps.<br /><em>Lasting knowledge.</em></>}
            </h2>
            <p>{dueEntries.length === 0 ? "Your words are in a good place. Come back for a fresh start." : <><strong>{dueEntries.length} {dueEntries.length === 1 ? "word" : "words"}</strong> ready for a little refresh.</>}</p>
            {dueEntries.length > 0 ? (
              <button
                type="button"
                className="primary-action today-start-review"
                onClick={() => onStartReview(dueEntries)}
              >
                Start review
                <Icon name="arrow-up-right" size={18} />
              </button>
            ) : (
              <button type="button" className="primary-action today-start-review" onClick={onAdd}>
                Find a new word <Icon name="plus" size={18} />
              </button>
            )}
            {dueEntries.length > 0 && <span className="review-duration">About {Math.max(1, Math.ceil(dueEntries.length * 0.4))} min · At your own pace</span>}
          </div>
          <div className="word-sculpture" aria-hidden="true">
            <span className="sculpture-orbit sculpture-orbit-one" />
            <span className="sculpture-orbit sculpture-orbit-two" />
            <span className="sculpture-glow" />
            <span className="sculpture-tile sculpture-tile-back">文<small>DISCOVER</small></span>
            <span className="sculpture-tile sculpture-tile-front">Aa<small>REMEMBER</small></span>
            <span className="sculpture-spark"><Icon name="sparkles" size={24} /></span>
          </div>
        </LiquidGlassSurface>

        <LiquidGlassSurface
          as="section"
          id="today-streak-card"
          className="today-streak-card"
          variant="panel"
          radius={25}
          intensity={0.98}
          aria-labelledby="today-streak-title"
        >
          <header className="today-panel-heading">
            <span className="today-panel-icon" aria-hidden="true">
              <Icon name="flame" size={20} />
            </span>
            <div>
              <h2 id="today-streak-title">Your learning rhythm</h2>
            </div>
          </header>
          <p className="streak-number"><strong>{streak}</strong><span>{streak === 1 ? "day" : "days"}<small>in your current streak</small></span></p>

          <ol className="today-week-strip" aria-label="Reviews this week">
            {WEEKDAYS.map((weekday, index) => (
              <li
                key={`${weekday}-${index}`}
                className={[weeklyActivity[index] > 0 ? "active" : "", index === todayIndex ? "current-day" : ""].filter(Boolean).join(" ")}
                aria-label={`${DAY_NAMES[index]}: ${weeklyActivity[index]} reviews${index === todayIndex ? ", today" : ""}`}
              >
                <small>{weekday}</small>
                <span>{weeklyActivity[index] > 0 ? <Icon name="check" size={16} /> : <span className="week-dot" />}</span>
              </li>
            ))}
          </ol>
          <p className="today-week-summary"><Icon name="chart" size={14} /><strong>{weeklyReviewCount} reviews</strong> this week. Keep showing up.</p>
        </LiquidGlassSurface>
      </div>

      <div className="today-insights-grid">
        <LiquidGlassSurface
          as="section"
          id="today-attention-card"
          className="today-attention-card"
          variant="panel"
          radius={25}
          intensity={0.96}
          aria-labelledby="today-attention-title"
        >
          <header className="today-panel-heading">
            <span className="today-panel-icon today-panel-icon-warning" aria-hidden="true">
              <Icon name="target" size={20} />
            </span>
            <div><h2 id="today-attention-title">A little more practice</h2><p>Give these words another moment.</p></div>
          </header>

          <ul className="today-attention-list">
            {needsAttention.map((entry) => {
              const recallRate = Math.max(0, Math.min(100, Number(entry.recallRate ?? 0)));

              return (
                <li key={entry.id}>
                  <button type="button" onClick={() => onSelectEntry(entry)}>
                    <span className="today-attention-word">
                      <strong>{entry.word}</strong>
                      <span>{getPrimaryTranslation(entry)}</span>
                    </span>
                    <span className="today-recall-group">
                      <span>{recallRate}% recall</span>
                      <span className="today-recall-track" aria-hidden="true">
                        <span style={{ "--today-recall": `${recallRate}%` }} />
                      </span>
                    </span>
                    <Icon name="chevron-right" size={17} />
                  </button>
                </li>
              );
            })}
          </ul>
        </LiquidGlassSurface>

        {featuredEntry ? (
          <LiquidGlassSurface
            as="section"
            id="today-featured-card"
            className="today-featured-card"
            variant="panel"
            radius={25}
            intensity={1.06}
            aria-labelledby="today-featured-title"
          >
            <header className="today-panel-heading">
              <span className="today-panel-icon" aria-hidden="true">
                <Icon name="star" size={20} />
              </span>
              <h2 id="today-featured-title">A word to keep</h2>
            </header>

            <button
              type="button"
              className="today-featured-word"
              onClick={() => onSelectEntry(featuredEntry)}
            >
              <strong>{featuredEntry.word}</strong>
              <span>{getPrimaryTranslation(featuredEntry)}</span>
            </button>
            <div className="today-featured-pronunciation">
              <span>{featuredEntry.pronunciation}</span>
              <button
                type="button"
                className="icon-button"
                aria-label={`Hear ${featuredEntry.word}`}
                onClick={() => speakWord(featuredEntry)}
              >
                <Icon name="volume" size={17} />
              </button>
            </div>
            <div className="today-featured-example">
              <span>Example</span>
              <p>{featuredEntry.example || "No example has been added yet."}</p>
            </div>
          </LiquidGlassSurface>
        ) : null}
      </div>

      <section className="today-recent-section" aria-labelledby="today-recent-title">
        <header className="today-recent-header">
          <div>
            <span className="today-panel-icon" aria-hidden="true">
              <Icon name="clock" size={19} />
            </span>
            <h2 id="today-recent-title">Recently added</h2>
          </div>
          <button type="button" className="today-see-all" onClick={() => onSelectEntry(null)}>
            Open library
            <Icon name="chevron-right" size={16} />
          </button>
        </header>

        <div className="today-recent-rail">
          {recentEntries.map((entry) => (
            <RecentWordCard key={entry.id} entry={entry} onSelect={onSelectEntry} />
          ))}
        </div>
      </section>
    </main>
  );
}

export default TodayPage;

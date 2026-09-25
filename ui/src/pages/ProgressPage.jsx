import { useState } from "react";
import Icon from "../components/Icon.jsx";
import LiquidGlassSurface from "../glass/LiquidGlassSurface.jsx";
import "../studyNotebook.css";

const MASTERY_LEVELS = [
  { key: "developing", label: "Developing" },
  { key: "familiar", label: "Familiar" },
  { key: "mastered", label: "Mastered" },
];

const REVIEW_PERIODS = {
  week: {
    label: "Week",
    summary: "this week",
    points: [
      { label: "Mon" },
      { label: "Tue" },
      { label: "Wed" },
      { label: "Thu" },
      { label: "Fri" },
      { label: "Sat" },
      { label: "Sun" },
    ],
  },
  month: {
    label: "Month",
    summary: "this month",
    points: [
      { label: "Week 1" },
      { label: "Week 2" },
      { label: "Week 3" },
      { label: "Week 4" },
    ],
  },
};

function toPercentage(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.max(0, Math.min(100, number <= 1 ? number * 100 : number));
}

function getMastery(entry) {
  const label = String(entry?.mastery || entry?.status || "").toLowerCase();

  if (label.includes("master")) {
    return "mastered";
  }

  if (label.includes("familiar") || label.includes("learning")) {
    return "familiar";
  }

  const score = toPercentage(entry?.masteryScore ?? entry?.progress);

  if (score !== null && score >= 80) {
    return "mastered";
  }

  if (score !== null && score >= 45) {
    return "familiar";
  }

  return "developing";
}

function getReviewSeries(entries, period, points) {
  const field = period === "month" ? "monthlyReviews" : "weeklyReviews";
  const hasHistory = entries.some(
    (entry) => Array.isArray(entry?.[field]) && entry[field].length > 0
  );

  if (!hasHistory) return null;

  return points.map((point, pointIndex) => ({
    label: point.label,
    value: entries.reduce((sum, entry) => {
      const count = Array.isArray(entry?.[field]) ? Number(entry[field][pointIndex]) : 0;
      return sum + (Number.isFinite(count) ? Math.max(0, count) : 0);
    }, 0),
  }));
}

function getRecordedTotal(entries, period) {
  const field = period === "month" ? "monthlyReviews" : "weeklyReviews";
  const recordedCounts = entries.flatMap((entry) => {
    const value = entry?.[field];
    if (value === null || value === undefined || value === "") return [];
    return (Array.isArray(value) ? value : [value])
      .map(Number)
      .filter((count) => Number.isFinite(count) && count >= 0);
  });

  return recordedCounts.length > 0
    ? recordedCounts.reduce((sum, count) => sum + count, 0)
    : undefined;
}

function getLanguageStats(entries) {
  const languages = new Map();

  for (const entry of entries) {
    const language = entry?.language || "Other";
    const mastery = getMastery(entry);
    const current = languages.get(language) || {
      language,
      total: 0,
      developing: 0,
      familiar: 0,
      mastered: 0,
    };

    current.total += 1;
    current[mastery] += 1;
    languages.set(language, current);
  }

  return Array.from(languages.values()).map((language) => {
    const developing = Math.round((language.developing / language.total) * 100);
    const familiar = Math.round((language.familiar / language.total) * 100);
    const mastered = Math.max(0, 100 - developing - familiar);

    return {
      ...language,
      percentages: { developing, familiar, mastered },
    };
  });
}

function getRecallRate(entries) {
  if (entries.length === 0) {
    return null;
  }

  const explicitRates = entries
    .filter((entry) => entry?.reviewCount !== 0 || entry?.lastReviewedAt)
    .map((entry) => toPercentage(entry?.recallRate ?? entry?.recall))
    .filter((value) => value !== null);

  if (explicitRates.length > 0) {
    return Math.round(
      explicitRates.reduce((sum, value) => sum + value, 0) / explicitRates.length
    );
  }

  return null;
}

function getRecallChange(entries) {
  const changes = entries
    .filter((entry) => entry?.recallChange !== null && entry?.recallChange !== undefined && entry?.recallChange !== "")
    .map((entry) => Number(entry?.recallChange))
    .filter(Number.isFinite);

  if (changes.length === 0) {
    return null;
  }

  return Math.round(changes.reduce((sum, value) => sum + value, 0) / changes.length);
}

function getActivityCopy(entry) {
  const mastery = getMastery(entry);

  if (mastery === "mastered") {
    return "mastered";
  }

  if (mastery === "familiar") {
    return "marked familiar";
  }

  return "reviewed";
}

function getActivityIcon(entry) {
  const mastery = getMastery(entry);

  if (mastery === "mastered") {
    return "check";
  }

  if (mastery === "familiar") {
    return "arrow-up-right";
  }

  return "clock";
}

function getEntryTimestamp(entry) {
  const timestamp = Date.parse(entry?.lastReviewedAt || entry?.updatedAt || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function ProgressPage({ entries }) {
  const vocabularyEntries = Array.isArray(entries) ? entries : [];
  const [reviewPeriod, setReviewPeriod] = useState("week");
  const period = REVIEW_PERIODS[reviewPeriod];
  const reviewSeries = getReviewSeries(
    vocabularyEntries,
    reviewPeriod,
    period.points
  );
  const reviewTotal = getRecordedTotal(vocabularyEntries, reviewPeriod);
  const largestReviewValue = Math.max(...(reviewSeries || []).map((point) => point.value), 1);
  const recallRate = getRecallRate(vocabularyEntries);
  const recallChange = getRecallChange(vocabularyEntries);
  const languageStats = getLanguageStats(vocabularyEntries);
  const recentEntries = vocabularyEntries
    .filter((entry) => Number(entry.reviewCount) > 0 || entry.lastReviewedAt || /^Reviewed\b/i.test(entry.lastReviewedLabel || ""))
    .map((entry, index) => ({ entry, index }))
    .sort(
      (left, right) =>
        getEntryTimestamp(right.entry) - getEntryTimestamp(left.entry) ||
        left.index - right.index
    )
    .slice(0, 3)
    .map(({ entry }) => entry);

  return (
    <main className="progress-page" aria-labelledby="progress-page-title">
      <header className="progress-page-header">
        <h1 id="progress-page-title">My study log</h1>
        <p className="progress-page-description">
          A record of the words you keep coming back to.
        </p>
      </header>

      <div className="progress-overview-grid">
        <LiquidGlassSurface
          as="section"
          id="progress-review-rhythm"
          className="progress-rhythm-card"
          variant="panel"
          radius={28}
          intensity={1.08}
          aria-labelledby="progress-rhythm-title"
        >
          <header className="progress-card-header">
            <div>
              <p className="progress-card-eyebrow">A little, often</p>
              <h2 id="progress-rhythm-title">Back to the words</h2>
            </div>

            <div
              className="progress-period-switcher"
              role="group"
              aria-label="Review period"
            >
              {Object.entries(REVIEW_PERIODS).map(([value, option]) => (
                <button
                  key={value}
                  type="button"
                  className={
                    reviewPeriod === value
                      ? "progress-period-button progress-period-button-active"
                      : "progress-period-button"
                  }
                  aria-pressed={reviewPeriod === value}
                  onClick={() => setReviewPeriod(value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </header>

          <p className="progress-rhythm-total" aria-live="polite">
            {reviewTotal === undefined ? "No recorded history for this period" : <><strong>{reviewTotal}</strong> reviews {period.summary}</>}
          </p>

          {reviewSeries ? <figure className="progress-rhythm-figure">
            <figcaption className="progress-rhythm-caption">
              {reviewPeriod === "week" ? "Recorded reviews by day" : "Recorded reviews by week"}
            </figcaption>
            <ol className="progress-rhythm-plot">
              {reviewSeries.map((point) => (
                <li
                  key={point.label}
                  className="progress-rhythm-point"
                  style={{
                    "--progress-point": `${(point.value / largestReviewValue) * 72}%`,
                  }}
                  aria-label={`${point.label}: ${point.value} ${
                    point.value === 1 ? "review" : "reviews"
                  }`}
                >
                  <span className="progress-rhythm-marker" aria-hidden="true" />
                  <span className="progress-rhythm-value">{point.value}</span>
                  <span className="progress-rhythm-label">{point.label}</span>
                </li>
              ))}
            </ol>
          </figure> : <div className="progress-history-empty">
            <Icon name="book-open" size={28} />
            <p>{reviewTotal !== undefined ? "The total is here; the dates aren’t recorded yet." : reviewPeriod === "month" ? "No monthly history has been recorded yet." : "Your first review is the start of this page."}</p>
            <span>{reviewPeriod === "month" ? "Daily reviews are kept on the Week page." : "Practice a few words to leave a mark here."}</span>
          </div>}
        </LiquidGlassSurface>

        <LiquidGlassSurface
          as="section"
          id="progress-recall-card"
          className="progress-recall-card"
          variant="panel"
          radius={28}
          intensity={1.12}
          aria-labelledby="progress-recall-title"
        >
          <header className="progress-card-header">
            <h2 id="progress-recall-title">What’s sticking</h2>
          </header>

          <div
            className="progress-recall-ring"
            role="img"
            aria-label={recallRate === null ? "No recall rate recorded yet" : `${recallRate}% recorded recall rate`}
          >
            <strong>{recallRate === null ? "N/A" : `${recallRate}%`}</strong>
            <span>Recorded recall</span>
          </div>

          <p className="progress-recall-change">
            {recallChange === null
              ? recallRate === null ? "A fresh page. Keep practicing." : "A little more remembered."
              : `${recallChange >= 0 ? "+" : ""}${recallChange}% vs last period`}
          </p>
        </LiquidGlassSurface>
      </div>

      <LiquidGlassSurface
        as="section"
        id="progress-language-mastery"
        className="progress-mastery-card"
        variant="panel"
        radius={28}
        intensity={1.04}
        aria-labelledby="progress-mastery-title"
      >
        <header className="progress-mastery-header">
          <h2 id="progress-mastery-title">Where my words stand</h2>
          <ul className="progress-mastery-legend" aria-label="Mastery levels">
            {MASTERY_LEVELS.map((level) => (
              <li key={level.key} className={`progress-legend-${level.key}`}>
                <span aria-hidden="true" />
                {level.label}
              </li>
            ))}
          </ul>
        </header>

        {languageStats.length > 0 ? (
          <ul className="progress-language-list">
            {languageStats.map((language) => (
              <li key={language.language} className="progress-language-row">
                <div className="progress-language-name">
                  <span className="progress-language-icon" aria-hidden="true">
                    <Icon name="globe" size={20} />
                  </span>
                  <strong>{language.language}</strong>
                </div>

                <div
                  className="progress-mastery-bar"
                  aria-label={`${language.language}: ${language.percentages.developing}% developing, ${language.percentages.familiar}% familiar, ${language.percentages.mastered}% mastered`}
                >
                  {MASTERY_LEVELS.map((level) => (
                    <span
                      key={level.key}
                      className={`progress-mastery-segment progress-mastery-${level.key}`}
                      style={{
                        "--progress-segment": `${language.percentages[level.key]}%`,
                      }}
                    >
                      {language.percentages[level.key] >= 12 ? `${language.percentages[level.key]}%` : ""}
                    </span>
                  ))}
                </div>

                <span className="progress-language-total">
                  {language.total} {language.total === 1 ? "word" : "words"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="progress-mastery-empty">
            Add words to see mastery by language.
          </p>
        )}
      </LiquidGlassSurface>

      <LiquidGlassSurface
        as="section"
        id="progress-recent-activity"
        className="progress-activity-card"
        variant="panel"
        radius={28}
        intensity={1.02}
        aria-labelledby="progress-activity-title"
      >
        <header className="progress-card-header">
          <h2 id="progress-activity-title">Recent activity</h2>
          <span className="progress-activity-count">
            {vocabularyEntries.length} total {vocabularyEntries.length === 1 ? "word" : "words"}
          </span>
        </header>

        {recentEntries.length > 0 ? (
          <ul className="progress-activity-list">
            {recentEntries.map((entry, index) => (
              <li
                key={entry.id ?? `${entry.word}-${index}`}
                className="progress-activity-item"
              >
                <span className="progress-activity-icon" aria-hidden="true">
                  <Icon name={getActivityIcon(entry)} size={20} />
                </span>
                <span className="progress-activity-copy">
                  <span>
                    <strong>{entry.word}</strong> {getActivityCopy(entry)}
                  </span>
                  <time dateTime={entry.lastReviewedAt || entry.updatedAt || undefined}>
                    {entry.lastReviewedLabel || "Recently"}
                  </time>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="progress-activity-empty">
            Your review activity will appear here.
          </p>
        )}
      </LiquidGlassSurface>
    </main>
  );
}

export default ProgressPage;

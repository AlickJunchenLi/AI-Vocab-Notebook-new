import { useState } from "react";
import Icon from "../components/Icon.jsx";
import LiquidGlassSurface from "../motion/MotionSurface.jsx";
import MotionRegion from "../motion/MotionRegion.jsx";
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

function getRecall(entries) {
  const explicitRates = entries
    .filter((entry) => entry?.reviewCount !== 0 || entry?.lastReviewedAt)
    .map((entry) => toPercentage(entry?.recallRate ?? entry?.recall))
    .filter((value) => value !== null);

  if (explicitRates.length === 0) {
    return { rate: null, count: 0 };
  }

  return {
    rate: Math.round(
      explicitRates.reduce((sum, value) => sum + value, 0) / explicitRates.length
    ),
    count: explicitRates.length,
  };
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
  const { rate: recallRate, count: recallCount } = getRecall(vocabularyEntries);
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
    <main className="page progress-page" aria-labelledby="progress-page-title">
      <header className="page-header">
        <h1 id="progress-page-title">Progress</h1>
        <p>Reviews, recall and mastery across your words.</p>
      </header>

      <div className="progress-overview-grid">
        <LiquidGlassSurface
          as="section"
          id="progress-review-rhythm"
          className="progress-rhythm-card"
          variant="panel"
          radius={20}
          aria-labelledby="progress-rhythm-title"
        >
          <header className="progress-card-header">
            <h2 id="progress-rhythm-title">Reviews</h2>

            <div
              className="progress-period-switcher"
              data-period={reviewPeriod}
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

          {reviewSeries ? <figure key={reviewPeriod} className="progress-rhythm-figure">
            <figcaption className="sr-only">
              {reviewPeriod === "week" ? "Recorded reviews by day" : "Recorded reviews by week"}
            </figcaption>
            <ol className="progress-rhythm-plot">
              {reviewSeries.map((point, index) => (
                <li
                  key={point.label}
                  className="progress-rhythm-point"
                  style={{
                    "--progress-point": `${(point.value / largestReviewValue) * 72}%`,
                    "--motion-index": index,
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
            <p>{reviewTotal !== undefined ? "This period has a total, but no dates were recorded." : reviewPeriod === "month" ? "No monthly history yet." : "No reviews recorded this week."}</p>
            <span>{reviewPeriod === "month" ? "Switch to Week to see reviews by day." : "Reviews you finish in Practice appear here."}</span>
          </div>}
        </LiquidGlassSurface>

        <LiquidGlassSurface
          as="section"
          id="progress-recall-card"
          delay={0.05}
          className="progress-recall-card"
          variant="panel"
          radius={20}
          aria-labelledby="progress-recall-title"
        >
          <header className="progress-card-header">
            <h2 id="progress-recall-title">Recall</h2>
          </header>

          <p className="progress-recall-figure">
            <strong>{recallRate === null ? "None yet" : `${recallRate}%`}</strong>
            <span>{recallRate === null ? "Recall appears after your first review." : "Average recall"}</span>
          </p>

          {recallRate !== null ? (
            <p className="progress-recall-change">
              {recallChange === null
                ? `Across ${recallCount} reviewed ${recallCount === 1 ? "word" : "words"}`
                : `${recallChange >= 0 ? "+" : ""}${recallChange}% since last period`}
            </p>
          ) : null}
        </LiquidGlassSurface>
      </div>

      <MotionRegion
        as="section"
        reveal
        id="progress-language-mastery"
        className="progress-mastery-card"
        aria-labelledby="progress-mastery-title"
      >
        <header className="progress-mastery-header">
          <h2 id="progress-mastery-title">Mastery by language</h2>
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
      </MotionRegion>

      <MotionRegion
        as="section"
        reveal
        id="progress-recent-activity"
        className="progress-activity-card"
        aria-labelledby="progress-activity-title"
      >
        <header className="progress-card-header">
          <h2 id="progress-activity-title">Recent activity</h2>
          <span className="progress-activity-count">
            {vocabularyEntries.length} {vocabularyEntries.length === 1 ? "word" : "words"} in total
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
                    <strong className="hand">{entry.word}</strong> {getActivityCopy(entry)}
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
            Words you review appear here.
          </p>
        )}
      </MotionRegion>
    </main>
  );
}

export default ProgressPage;

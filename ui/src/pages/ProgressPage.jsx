import { useState } from "react";
import Icon from "../components/Icon.jsx";
import LiquidGlassSurface from "../glass/LiquidGlassSurface.jsx";

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
      { label: "Mon", weight: 1 },
      { label: "Tue", weight: 2 },
      { label: "Wed", weight: 3 },
      { label: "Thu", weight: 2 },
      { label: "Fri", weight: 4 },
      { label: "Sat", weight: 3 },
      { label: "Sun", weight: 2 },
    ],
  },
  month: {
    label: "Month",
    summary: "this month",
    points: [
      { label: "Week 1", weight: 2 },
      { label: "Week 2", weight: 3 },
      { label: "Week 3", weight: 4 },
      { label: "Week 4", weight: 5 },
    ],
  },
};

function toPercentage(value) {
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

function getReviewCount(entry, period) {
  const preferredValue =
    period === "month"
      ? entry?.monthlyReviews ?? entry?.reviewCount
      : entry?.weeklyReviews ?? entry?.reviewCount;
  const reviewCount = Number(preferredValue);

  return Number.isFinite(reviewCount) && reviewCount > 0 ? reviewCount : 0;
}

function getReviewSeries(entries, period, points) {
  if (period === "week") {
    const hasDailyReviews = entries.some(
      (entry) => Array.isArray(entry?.weeklyReviews) && entry.weeklyReviews.length > 0
    );

    if (hasDailyReviews) {
      return points.map((point, pointIndex) => ({
        label: point.label,
        value: entries.reduce((sum, entry) => {
          const dailyReviews = Number(entry?.weeklyReviews?.[pointIndex]);
          return sum + (Number.isFinite(dailyReviews) ? dailyReviews : 0);
        }, 0),
      }));
    }
  }

  const reviewTotal = entries.reduce(
    (sum, entry) => sum + getReviewCount(entry, period),
    0
  );

  return distributeTotal(reviewTotal, points);
}

function distributeTotal(total, points) {
  const weightTotal = points.reduce((sum, point) => sum + point.weight, 0);
  const values = points.map((point) => Math.floor((total * point.weight) / weightTotal));
  let remaining = total - values.reduce((sum, value) => sum + value, 0);
  let index = points.length - 1;

  while (remaining > 0) {
    values[index] += 1;
    remaining -= 1;
    index = index === 0 ? points.length - 1 : index - 1;
  }

  return points.map((point, pointIndex) => ({
    label: point.label,
    value: values[pointIndex],
  }));
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
    return 0;
  }

  const explicitRates = entries
    .map((entry) => toPercentage(entry?.recallRate ?? entry?.recall))
    .filter((value) => value !== null);

  if (explicitRates.length > 0) {
    return Math.round(
      explicitRates.reduce((sum, value) => sum + value, 0) / explicitRates.length
    );
  }

  const masteryWeights = {
    developing: 35,
    familiar: 72,
    mastered: 95,
  };

  return Math.round(
    entries.reduce((sum, entry) => sum + masteryWeights[getMastery(entry)], 0) /
      entries.length
  );
}

function getRecallChange(entries) {
  const changes = entries
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
    return "moved to Familiar";
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
  const reviewTotal = reviewSeries.reduce((sum, point) => sum + point.value, 0);
  const largestReviewValue = Math.max(...reviewSeries.map((point) => point.value), 1);
  const recallRate = getRecallRate(vocabularyEntries);
  const recallChange = getRecallChange(vocabularyEntries);
  const languageStats = getLanguageStats(vocabularyEntries);
  const recentEntries = vocabularyEntries
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
        <h1 id="progress-page-title">See what is sticking</h1>
        <p className="progress-page-description">
          Small, consistent reviews turn new words into lasting recall.
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
              <p className="progress-card-eyebrow">Review rhythm</p>
              <h2 id="progress-rhythm-title">Keep the habit moving</h2>
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
            <strong>{reviewTotal}</strong> reviews {period.summary}
          </p>

          <figure className="progress-rhythm-figure">
            <figcaption className="progress-rhythm-caption">
              Review activity for each day in the selected period
            </figcaption>
            <ol className="progress-rhythm-plot">
              {reviewSeries.map((point) => (
                <li
                  key={point.label}
                  className="progress-rhythm-point"
                  style={{
                    "--progress-point": `${(point.value / largestReviewValue) * 100}%`,
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
          </figure>
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
            <h2 id="progress-recall-title">Recall</h2>
            <Icon name="chart" size={18} className="progress-card-icon" />
          </header>

          <div
            className="progress-recall-ring"
            style={{ "--progress-recall": `${recallRate}%` }}
            role="img"
            aria-label={`${recallRate}% recall rate`}
          >
            <strong>{recallRate}%</strong>
            <span>Recall rate</span>
          </div>

          <p className="progress-recall-change">
            <Icon name="arrow-up-right" size={17} />
            {recallChange === null
              ? "Building your baseline"
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
                      {language.percentages[level.key]}%
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

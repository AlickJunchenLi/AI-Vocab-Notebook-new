import { Fragment, useLayoutEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import { contentGroups } from "../motion/contentReveal.js";
import { measureWelcome, playWelcome } from "./welcomeRitual.js";
import { saveWelcomeSeen } from "./welcome.js";
import "./todayHeader.css";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SKIP_ON = ["keydown", "pointerdown", "wheel", "touchstart"];

function greetingFor(date) {
  const hour = date.getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

// The greeting as runs of text, the reader's name set apart in the ink.
function greetingRuns(greeting, name) {
  return name
    ? [{ text: `${greeting}, ` }, { text: name, mark: "today-greeting-name" }, { text: "." }]
    : [{ text: `${greeting}.` }];
}

// The summary as runs of text, the count set apart so it can stand out.
function summaryFor(wordCount, dueCount) {
  if (wordCount === 0) {
    return [{ text: "Your notebook is empty. Add a word to begin." }];
  }

  if (dueCount === 0) {
    return [{ text: "Nothing is due today. Add a word you met recently." }];
  }

  return [
    { text: "You have " },
    { text: String(dueCount), mark: "is-strong" },
    { text: ` ${dueCount === 1 ? "word" : "words"} ready to review today.` },
  ];
}

// Words of letters, split at spaces so the sentence still wraps between words.
function toWords(runs) {
  const words = [[]];

  for (const run of runs) {
    for (const char of run.text) {
      if (char === " ") {
        if (words.at(-1).length > 0) words.push([]);
      } else {
        words.at(-1).push({ char, mark: run.mark });
      }
    }
  }

  return words.filter((word) => word.length > 0);
}

/*
 * A line set letter by letter for the welcome, which moves each letter on
 * its own: the whole text once for assistive technology, and the letters,
 * hidden from it, in words that wrap as the text would.
 */
function Lettered({ runs, className, wordClass, letterClass }) {
  return (
    <>
      <span className="sr-only">{runs.map((run) => run.text).join("")}</span>
      <span className={className} aria-hidden="true">
        {toWords(runs).map((word, wordIndex) => (
          <Fragment key={wordIndex}>
            {wordIndex > 0 ? " " : null}
            <span className={wordClass}>
              {word.map((letter, index) => (
                <span key={index} className={letter.mark ? `${letterClass} ${letter.mark}` : letterClass}>
                  {letter.char}
                </span>
              ))}
            </span>
          </Fragment>
        ))}
      </span>
    </>
  );
}

function checkinLine(wordCount, weekTotal, streak) {
  if (wordCount === 0) {
    return null;
  }

  if (weekTotal === 0) {
    return <span>No reviews yet this week</span>;
  }

  return (
    <>
      {streak > 0 ? <span><strong>{streak}</strong>-day streak</span> : null}
      <span><strong>{weekTotal}</strong> {weekTotal === 1 ? "review" : "reviews"} this week</span>
    </>
  );
}

/*
 * Today's header: a greeting (with the reader's name when they have given
 * one), how many words are waiting, and this week's check-in on a strip of
 * paper beneath. When the notebook opens here, `welcome` ("full" the first
 * time each day, "brief" after) plays the sequence in welcomeRitual.js,
 * which any key, click, scroll or touch hurries to its end; `onWelcomeDone`
 * is called once it has played.
 */
export default function TodayHeader({
  name,
  wordCount,
  dueCount,
  mastered,
  languages,
  activity,
  todayIndex,
  streak,
  welcome = false,
  onWelcomeDone,
}) {
  const headerRef = useRef(null);
  const greetingLineRef = useRef(null);
  const greetingRef = useRef(null);
  const summaryRef = useRef(null);
  const tallyRef = useRef(null);
  const checkinRef = useRef(null);
  const paperRef = useRef(null);
  const infoRef = useRef(null);
  // A page that opened with the welcome keeps its letters set one by one,
  // so the text never reflows, and doesn't play the header's usual entrance
  // again once the welcome has brought it in (data-welcomed).
  const [lettered] = useState(Boolean(welcome));

  const now = new Date();
  const greeting = greetingFor(now);
  const runs = summaryFor(wordCount, dueCount);
  const weekTotal = activity.reduce((sum, count) => sum + count, 0);
  const language = document.documentElement.lang || undefined;
  const stamp = new Intl.DateTimeFormat(language, { weekday: "short", day: "numeric", month: "short" }).format(now);
  const fullDate = new Intl.DateTimeFormat(language, { weekday: "long", day: "numeric", month: "long" }).format(now);
  const line = checkinLine(wordCount, weekTotal, streak);

  useLayoutEffect(() => {
    if (!welcome) {
      return undefined;
    }

    const header = headerRef.current;
    const page = header.parentElement;
    let ritual = null;
    let ended = false;
    const skip = () => ritual?.skip();

    // A page opened in a background tab draws nothing, but its animations
    // still run out; the welcome waits until it can be seen, and only then
    // does the full one count as the day's.
    function start() {
      if (ritual || document.visibilityState === "hidden") {
        return;
      }

      const parts = {
        greetingStage: greetingLineRef.current,
        greeting: greetingRef.current,
        summaryStage: summaryRef.current,
        summaryText: summaryRef.current.querySelector(".today-summary-letters"),
        greetingLetters: [...greetingRef.current.querySelectorAll(".today-greeting-letter")],
        letters: [...summaryRef.current.querySelectorAll(".today-letter")],
        checkin: checkinRef.current,
        paper: paperRef.current,
        info: infoRef.current,
        // The notebook around the page stays quiet until the header is set.
        chrome: [...document.querySelectorAll(".top-menu > *")],
        tally: tallyRef.current,
        container: page.querySelector(":scope > .today-body"),
        groups: [
          ...contentGroups(page.querySelector(":scope > .today-body")),
          document.querySelector(".notebook-footer"),
        ].filter(Boolean),
      };
      const layout = measureWelcome(parts);

      ritual = playWelcome(parts, layout, welcome);
      if (welcome === "full") saveWelcomeSeen();
      document.removeEventListener("visibilitychange", start);
      ritual.finished.then(() => {
        if (!ended) onWelcomeDone?.();
      }, () => {});
    }

    start();
    document.addEventListener("visibilitychange", start);
    SKIP_ON.forEach((type) => window.addEventListener(type, skip, { capture: true, passive: true }));
    window.addEventListener("resize", skip);

    return () => {
      ended = true;
      document.removeEventListener("visibilitychange", start);
      SKIP_ON.forEach((type) => window.removeEventListener(type, skip, { capture: true }));
      window.removeEventListener("resize", skip);
      ritual?.cancel();
    };
  }, [welcome, onWelcomeDone]);

  return (
    <>
      <header ref={headerRef} className="today-header" data-welcomed={lettered || undefined}>
        <div className="today-title">
          <h1 ref={greetingLineRef} id="today-page-title" className="today-greeting">
            <span ref={greetingRef} className="today-greeting-line">
              {lettered ? (
                <Lettered
                  runs={greetingRuns(greeting, name)}
                  className="today-greeting-letters"
                  wordClass="today-greeting-word"
                  letterClass="today-greeting-letter"
                />
              ) : (
                <>
                  {greeting}
                  {name ? <>, <span className="today-greeting-name">{name}</span></> : null}.
                </>
              )}
            </span>
          </h1>
          <p ref={summaryRef} className="today-summary">
            {lettered ? (
              <Lettered runs={runs} className="today-summary-letters" wordClass="today-word" letterClass="today-letter" />
            ) : (
              runs.map((run, index) => (run.mark ? <strong key={index}>{run.text}</strong> : run.text))
            )}
          </p>
        </div>

        {wordCount ? (
          <dl ref={tallyRef} className="today-tally" aria-label="Your vocabulary at a glance">
            <div><dt>Words</dt><dd>{wordCount}</dd></div>
            <div><dt>Mastered</dt><dd>{mastered}</dd></div>
            <div><dt>{languages === 1 ? "Language" : "Languages"}</dt><dd>{languages}</dd></div>
          </dl>
        ) : null}
      </header>

      <section ref={checkinRef} className="today-checkin" aria-labelledby="today-checkin-title" data-welcomed={lettered || undefined}>
        <div ref={paperRef} className="checkin-paper" aria-hidden="true">
          <div className="checkin-sheet" />
        </div>
        <div ref={infoRef} className="checkin-info">
          <h2 id="today-checkin-title" className="checkin-stamp">
            <span className="sr-only">Check-in for </span>
            <time dateTime={now.toLocaleDateString("en-CA")} title={fullDate}>{stamp}</time>
          </h2>
          <ol className="checkin-days" aria-label="Reviews this week">
            {DAYS.map((day, index) => {
              const count = activity[index];
              const isToday = index === todayIndex;
              return (
                <li
                  key={index}
                  className={isToday ? "is-today" : undefined}
                  aria-label={`${DAY_NAMES[index]}: ${count} ${count === 1 ? "review" : "reviews"}${isToday ? ", today" : ""}`}
                >
                  <span aria-hidden="true">{day}</span>
                  <span className={count ? "checkin-mark is-done" : "checkin-mark"} aria-hidden="true">
                    {count ? <Icon name="check" size={13} weight="bold" /> : null}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="checkin-figures">
            {line ?? <span>Your first review starts this week’s record.</span>}
          </p>
        </div>
      </section>
    </>
  );
}

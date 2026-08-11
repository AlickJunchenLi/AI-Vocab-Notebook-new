# Frontend plan

Design only — screens, states and interactions. No backend design here; each section
notes what it would eventually need from the API, nothing more.

## Where the UI stands today

Three pages, hash-routed, all state in `localStorage` over `mockEntries`:

- **Library** — search / language filter / sort, a word list with the glass selector,
  a 420px detail sidebar, add / edit / delete modals.
- **Practice** — one card at a time, reveal, four-way assessment, session sidebar,
  completion card.
- **Progress** — review rhythm chart (week/month), recall ring, mastery by language,
  recent activity.

Design system in place: `LiquidGlassSurface` (card/panel/button/menu/sidebar),
`GlassSelector` (the sprung selection glass), `GlassSelect`, `Icon`, modals with
`useDialogFocus`.

Two components are built and unused: `WordCard.jsx` and `DetailPanel.jsx`.

## Gaps worth closing

| Gap | Why it hurts |
| --- | --- |
| No landing page for "what do I do now" | The app opens on the full library; a review app should open on today's queue |
| Detail lives only in a 420px sidebar | No room for examples, relations, history; not linkable |
| No settings | No dark mode, no daily goal, no export, no way to turn the glass down |
| Bulk entry missing | Words arrive in lists (a chapter, a lesson), added one modal at a time |
| Destructive actions are final | Delete has a confirm but no undo |
| Practice has one mode | Recognition only; no typing, no listening, no direction choice |
| Keyboard support stops at the select | The list and the practice flow are mouse-only |
| Light-only, desktop-first | No dark theme; the two-column layouts have no mobile story |

---

## New pages

### 1. Today `#/today` — becomes the default route

The home screen. Answers "what should I do right now" in one glance.

```
┌──────────────────────────────────────────────────────────────┐
│  Good evening.  Thursday, 11 August                          │
│  12 words are ready for review.                              │
│                                                              │
│  ┌────────────────────────┐  ┌────────────────────────────┐  │
│  │  ◍ 12                  │  │  Streak                    │  │
│  │  due today             │  │  ▢▣▣▣▢▣▣  6 days           │  │
│  │  [ Start review → ]    │  │  Best: 14                  │  │
│  └────────────────────────┘  └────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────┐ ┌───────────────────────┐ │
│  │ Needs attention               │ │ Word of the day       │ │
│  │ 努力      recall 41%   →      │ │ lucid                 │ │
│  │ obscure   recall 52%   →      │ │ 清楚的 · 明晰的        │ │
│  │ 谨慎      recall 58%   →      │ │ "…"                   │ │
│  └───────────────────────────────┘ └───────────────────────┘ │
│                                                              │
│  Recently added                          [ See all → ]       │
│  ▸ card ▸ card ▸ card ▸ card                                 │
└──────────────────────────────────────────────────────────────┘
```

- **Due card** is the hero: a big count, one primary action that jumps straight into a
  practice session scoped to the due set. When the queue is empty it flips to a calm
  "You're clear for today" state with the next due date.
- **Streak strip**: seven day-dots, filled for days with ≥1 review. Same visual grammar
  as the mastery bar so it doesn't read as a new component family.
- **Needs attention**: the three lowest-recall words, each a link to the word page.
  This is the only place the app tells the user what to worry about.
- **Recently added** reuses the orphaned `WordCard` in a horizontal scroller — it earns
  the component its keep.
- Empty first-run state: single glass panel, "Add your first word", nothing else.

Needs from the API later: due count, per-day review timestamps for the streak.
All derivable from what entries already carry.

### 2. Word detail `#/word/:id`

Promotes the sidebar to a real page. The sidebar stays for quick looks; this is where
you go to actually work on a word.

```
┌──────────────────────────────────────────────────────────────┐
│  ← Library                                    [Edit] [ ⋯ ]   │
│                                                              │
│  lucid                              ┌──────────────────────┐ │
│  /ˈluːsɪd/  ◂))            English  │  Mastery             │ │
│                                     │  ◍ Familiar          │ │
│  TRANSLATION                        │  recall 78%          │ │
│  清楚的 · 明晰的                      │  12 reviews          │ │
│                                     │  next due in 3 days  │ │
│  DEFINITION                         └──────────────────────┘ │
│  expressed clearly; easy to …                                │
│                                     ┌──────────────────────┐ │
│  EXAMPLES                    [ + ]  │  Review history      │ │
│  · She gave a lucid account …       │  ▁▃▂▅▄▆▇             │ │
│  · 他的解释很清楚。                   │  last 8 weeks        │ │
│                                     └──────────────────────┘ │
│  RELATED                                                     │
│  ⟨synonym⟩ clear  understandable                             │
│  ⟨translation⟩ 清楚的  明晰的                                  │
│  [ + link a word ]                                           │
│                                                              │
│  [ Practice this word ]                                      │
└──────────────────────────────────────────────────────────────┘
```

- **Related** is the piece the sidebar can't show: relation chips grouped by type,
  each a link to that word. The DB already models relations (`relations_v2`), so the
  UI should stop pretending a word is an island.
- **Examples** become a list you can add to, not a single string.
- **Review history** is a sparkline built from the same weekly data the Progress page
  already aggregates.
- Deep-linkable: `#/word/3` from search, from Today, from a relation chip.
- Missing-data states matter here — most fields are "not added yet" for new words.
  Each empty field renders as a muted "Add a definition" affordance rather than a
  dead line, turning the page into the natural place to enrich a word.

### 3. Import `#/import`

Words arrive in batches. This is the paste-a-list flow.

```
Step 1  Paste            Step 2  Review             Step 3  Confirm
┌───────────────────┐    ┌───────────────────────┐   ┌──────────────┐
│ happy 开心, 快乐   │    │ ✓ happy    EN  2 links│   │ 14 new       │
│ lucid 清楚的       │ →  │ ✓ lucid    EN  1 link │ → │  3 duplicates│
│ 努力 effort       │    │ ⚠ 努力     ZH  dupe   │   │  [ Import ]  │
│ …                 │    │ [row → edit inline]   │   └──────────────┘
└───────────────────┘    └───────────────────────┘
  separator: line / comma / tab
  language: auto-detect · force EN · force ZH
```

- Parsing is a **preview table**, never a silent import: one row per parsed word, with
  the detected language, the translations it split out, and a duplicate warning against
  the existing library.
- Rows are editable inline and individually excludable (checkbox column).
- The "one English word → several Chinese words become synonyms of each other" rule
  from the project notes surfaces here as a visible **link count** per row, so the user
  can see the relations before they're created.
- Also the natural home for **file import** (CSV/JSON) and **export** later.

### 4. Settings `#/settings`

One page, sectioned, no sub-navigation.

- **Appearance** — theme (Light / Dark / System), *glass intensity* (Full / Reduced /
  Off). The app leans hard on backdrop-filter; a reduced setting that drops the blur
  and displacement is both an accessibility and a low-end-GPU answer.
- **Practice** — session length (10 / 20 / all due), default direction
  (Recognition / Production / Mixed), whether to auto-play pronunciation.
- **Daily goal** — words per day, feeds the Today streak card.
- **Data** — export JSON, import file, clear local data (with a typed confirmation).
- **About** — version, storage in use.

Settings live in `localStorage` under their own key and are read through a
`useSettings` hook, so no backend involvement.

### 5. Command palette — overlay, not a page (`⌘K` / `Ctrl+K`)

Anywhere in the app: type to jump to a word, or run an action ("Add word",
"Start review", "Go to Progress", "Toggle dark mode"). Reuses the `GlassSelect` menu
styling at overlay scale — same slab, same active/selected marks, no new visual idea.
This is the fastest thing on the list to build and the one that makes the app feel
finished.

---

## Additions to existing pages

### Library

- **Keyboard navigation.** `↑`/`↓` move the selection, `Enter` opens the word page,
  `e` edits, `⌫` deletes. The glass selector already animates off `activeKey`, so it
  comes along for free — this is the single highest value-per-line change in the app.
- **View toggle** — list ⇄ grid, where grid renders the unused `WordCard`.
- **Filter chips** above the list: `Due today`, `Needs attention`, `Not practiced yet`,
  `Mastered`. Chips beat burying these in the sort dropdown.
- **Multi-select + bulk bar.** Checkbox on hover, then a glass action bar slides up from
  the bottom: "3 selected — Practice · Change language · Delete".
- **Tags / collections** — a chip list on the word, a tag filter in the toolbar.
- **Sticky column header** once the list is long, and windowing past ~200 rows.

### Practice

- **Session setup card** before the first word: how many, which language, which
  direction, "due only" or "everything". Today the session is silently "all entries".
- **Modes**: Recognition (word → meaning, current behaviour), Production (meaning →
  word), Typing (type the answer, diff against it), Listening (`speechSynthesis` is
  already wired in `speakWord`).
- **Keyboard**: `Space` reveals, `1`–`4` rate, `U` undoes the last rating. A card-based
  review flow without a keyboard path is a card flow nobody uses twice.
- **Undo** the previous assessment — it is the single most-wanted control in every
  flashcard app.
- **Completion screen** should list the words rated Again/Hard with a "practice these
  again" button, instead of only three numbers.

### Progress

- **Streak heatmap** — 12 weeks of day cells, GitHub-style, in the app's palette.
- **Per-word table** sorted by recall, with a sparkline column: the "which words are
  failing" view, linked to word pages.
- **Goal ring** next to the recall ring once a daily goal exists.
- Period switcher gains `Year`.

---

## Cross-cutting

| Piece | Design note |
| --- | --- |
| **Toasts** | Bottom-centre glass pill, 4s, with an **Undo** action. Delete becomes reversible; the confirm modal can then be dropped for single deletes. |
| **Dark theme** | `index.css` already centralises every colour as a custom property, so this is a `prefers-color-scheme` block plus a `[data-theme]` override. The glass layers need their own dark values — white highlights become low-alpha whites over a deep navy, not inverted greys. |
| **Mobile** | Below 900px the Library and Practice two-column layouts stack; the detail sidebar becomes a bottom sheet; the top menu collapses to brand + a bottom tab bar. Modals become full-height sheets. |
| **Loading / error** | Skeleton rows for the list and shimmer blocks for the panels, ready for when the SQLite backend is actually wired in. One inline error banner component, reused. |
| **Empty states** | Library and Practice have them; Progress, Today and Word detail need them. |
| **Motion** | Every new surface honours `prefers-reduced-motion`, as the selector and select already do. |

New shared components this implies: `Toast`, `Chip`/`Tag`, `SegmentedControl` (the
Progress period switcher generalised), `Sparkline`, `Sheet` (mobile modal), `EmptyState`.

---

## Suggested build order

1. **Library keyboard navigation** — small, makes the existing hero feature usable.
2. **Toasts + undo** — removes the app's only unrecoverable action.
3. **Today page** — changes what the app *is* on open; pure frontend, no new data.
4. **Word detail page** — unlocks relations, the most under-used thing in the schema.
5. **Practice session setup + keyboard + undo** — turns a demo flow into a usable one.
6. **Settings** (incl. dark mode + glass intensity) — accessibility debt, and cheap.
7. **Import** — the biggest UI surface; worth doing once the shell is settled.
8. **Command palette** — polish, best once there are more places to jump to.

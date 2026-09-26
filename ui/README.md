# Vocabulary Notebook

A React + Vite vocabulary notebook with a daily dashboard, searchable English/Chinese library, keyboard-friendly review sessions, and progress views. Entries are saved locally in the browser.

## Run

```sh
npm ci
npm run dev
```

`npm run build` creates the production bundle; `npm run preview` serves that bundle. `npm run lint` checks the source.

## Appearance

The **Appearance** button in the header opens one menu for everything about how the notebook looks:

- **Ink**: Lavender, **Blue** (default), Pink or Green. Each comes with its own paper stock: lilac paper on a dusty violet desk, cool blue-grey exercise-book paper, warm blush, or sage. On dark paper they become aubergine, navy, plum and forest. Each swatch shows its paper around its ink.
- **Paper**: light or dark.
- **Ruled lines** on the note, the word list and other written areas.
- **Glass edge light**: the cursor effect described below.

Every choice is saved on this device. The ink and paper are applied before the first paint, so the page never flashes the defaults.

Each theme is five numbers in `src/index.css`: the ink's hue, a companion hue for the glass, and a chroma scale that keeps the ink inside the sRGB gamut, plus the paper's hue and how strongly it is tinted. Every other colour (desk, paper, pencil rules, text, shadows, glass edges, the notebook's cover) is an `oklch()` value built from those, in the same file, for light and dark paper; every pairing of text and paper passes WCAG AA. Switching themes fades through a near-grey pearl so neither the ink nor the paper sweeps through unrelated colours, and the browser's own bars take the desk colour. The danger colour and the red margin line stay fixed on purpose.

## Look and type

The pages are written on paper and the containers (cards, the open library entry, dialogs, menus and the toast) are liquid glass laid on top of it. Only the words you collect are handwritten, in Caveat (Chinese words fall back to a Kai face); everything else is set in DM Sans. Icons come from [Phosphor](https://phosphoricons.com).

## Opening

Each time the notebook loads, it arrives closed: a cloth-bound cover in a deep shade of the current ink, with a paper label in the middle showing the title and how many words and languages the notebook holds. The cover rests for a moment, then fades away to show today's page, just under a second in all. Any key, click, scroll or touch skips it, and it is left out entirely when reduced motion is requested. The notebook waits for its fonts before it first renders (at most 0.8s, in `src/main.jsx`), so the title is drawn in its final face from the first frame. The cover is `src/components/NotebookOpening.jsx`; its look and timing are the `.notebook-opening` rules in `src/App.css` (`--cover-delay` and `--cover-time`); its colours are the `--cover` tokens in `src/index.css`.

## Motion

The motion follows the notebook's calm study rhythm (taste-skill motion intensity 4/10). Cards lift into view by 8px, review prompts arrive from 12px to the right, and menus and dialogs settle into place before fading out in 120ms. Below-the-fold notes, cards and progress sections reveal once as they enter the viewport. Tabs, paper/period segments, switches, selected word markers, buttons, progress bars and completion checks give brief feedback; reading surfaces do not loop or float.

`src/motion/useNotebookMotion.js` owns the shared entrance/exit presets. `MotionSurface` adds motion to the existing glass component without changing its DOM, while `MotionRegion` handles plain elements. `src/motion/notebookMotion.css` owns control feedback and small CSS sequences. Motion runs through `LazyMotion` with `domAnimation`, without drag or layout-measurement features. Only opacity and transforms are animated by this layer, and stagger delays stay below 220ms.

Reduced motion uses immediate states in both React and CSS, with no hover travel. Exiting menus, dialogs and toasts become inert immediately. Dialog focus and scroll locking are released at dismissal rather than after the exit animation; pending autofocus frames are cancelled on cleanup. The practice progress indicator retains its accessible value and text while its visual fill animates with `scaleX`.

## Liquid glass

The pointer acts like a small lamp held just above the page, and nothing is drawn at the cursor itself. As it nears the edge of a glass surface, the rim there swells and its highlight brightens, with a thin darker line along the edge so the light reads on pale glass; in a corner, both edges respond. The swell follows with a slight springy lag, and the light takes the current ink's hue. On dark paper the roles turn round: the line along the edge is pale ink and the glow is a soft wash of the ink colour, so it reads the same way without going white. The colours and their strengths are the `--lg-*` tokens in `src/index.css`. The bevel follows a soft maximum of the four edges rather than the exact distance, so its contours stay rounded at every depth and the light turns a corner without a seam. **Glass edge light** in the Appearance menu switches the effect on or off and remembers your choice on this device. The effect is kept to containers; ink buttons are plain.

The effect is drawn by a small WebGL layer ([OGL](https://github.com/oframe/ogl)) on the few surfaces nearest the pointer (up to four, enough for every card around a gap); every pixel is lit on its own, so the light never jumps from one edge to another. While a dialog is open, only its surfaces react. Without WebGL, a CSS rim highlight lit from the pointer's position takes over. The effect keeps the native pointer visible and never intercepts clicks. It is disabled on touch/coarse pointers, when reduced motion is requested, and in forced-colors mode. Rendering pauses once the pointer and highlights settle, and resets when the tab is hidden or loses focus.

The effect's defaults live in `src/glass/liquidField.js`. With the dev server running, `/liquid.html` is a tuning page with a slider for each of them; click the page to pin the light in place while you adjust.

The shared material and pointer behavior are in `src/glass/`. The notebook shell and shared components are styled in `src/App.css`, and each page has its own stylesheet (`todayNotebook.css`, `libraryNotebook.css`, `studyNotebook.css`). On small screens the page tabs sit in a row under the header.

## Keyboard shortcuts

| View | Shortcut | Action |
| --- | --- | --- |
| Library | `/` | Focus search |
| Library word list | `↑` / `↓` | Select a word |
| Library word list | `Enter` | Start practice |
| Library word list | `E` | Edit the selected word |
| Library word list | `Delete` | Open the removal confirmation |
| Practice | `Space` | Reveal meaning |
| Practice | `1`–`4` | Rate Again, Hard, Good, or Easy |

Practice shortcuts do not run while a dialog or text field is active. The first Tab stop provides a skip-to-content link.

## Verification

- Production build and ESLint.
- Browser checks for search, language filtering, add-word submission, a complete keyboard review session, and the persisted glass toggle.
- Desktop and mobile layout checks, including the page tabs and the weekly progress chart, on light and dark paper.
- Cursor lifecycle checks for settling, pointer leave, reduced motion, disabled mode, touch input, and cleanup.
- Liquid layer checks for which surfaces get a layer (including nested surfaces and open dialogs), ink and paper changes, the Glass edge light switch, and the CSS fallback after a lost WebGL context.

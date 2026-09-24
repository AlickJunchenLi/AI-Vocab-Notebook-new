# Vocabulary Notebook

A React + Vite vocabulary notebook with a daily dashboard, searchable English/Chinese library, keyboard-friendly review sessions, and progress views. Entries are saved locally in the browser.

## Run

```sh
npm ci
npm run dev
```

`npm run build` creates the production bundle; `npm run preview` serves that bundle. `npm run lint` checks the source.

## Colour themes

Pick **Lavender** (default), **Blue**, **Pink** or **Green** from the swatches in the header. Below 980px wide, the swatches fold behind a single button showing the current theme. The choice is saved on this device and applied before the first paint, so the page never flashes the default colours.

Each theme is only three numbers in `src/index.css`: a main hue, a companion hue for the cooler washes, and a chroma scale that keeps saturated colours inside the sRGB gamut. Every brand-tinted colour in the stylesheets is an `oklch()` value relative to those hues. The amber streak, mint and danger colours stay fixed on purpose. The cursor glass light follows the theme too (see below).

## Liquid glass

The pointer acts like a small lamp held just above the page, and nothing is drawn at the cursor itself. As it nears the edge of a glass surface, the rim there swells and its highlight brightens, with a thin darker line along the edge so the light reads on pale glass. The rim also sends a soft streak of light through the glass towards the cursor, widest where it leaves the edge and thinning out just short of the cursor, with no outline of its own. In a corner, both edges reach in. The trace follows with a slight springy lag, and the light takes the current theme's hue. The **Glass** button in the header switches the cursor effect on or off and remembers your choice on this device. On smaller screens, it appears as a sparkle icon.

The effect is drawn by a small WebGL layer ([OGL](https://github.com/oframe/ogl)) on the one or two surfaces nearest the pointer; every pixel is lit on its own, so the light never jumps from one edge to another. While a dialog is open, only its surfaces react. Without WebGL, a CSS rim highlight lit from the pointer's position takes over. The effect keeps the native pointer visible and never intercepts clicks. It is disabled on touch/coarse pointers, when reduced motion is requested, and in forced-colors mode. Rendering pauses once the pointer and highlights settle, and resets when the tab is hidden or loses focus.

The effect's defaults live in `src/glass/liquidField.js`. With the dev server running, `/liquid.html` is a tuning page with a slider for each of them; click the page to pin the light in place while you adjust.

The shared material and pointer behavior are in `src/glass/`; the notebook's visual styling and responsive layouts are in `src/notebook.css`. The mobile navigation is fixed at the bottom of the screen.

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
- Desktop and mobile layout checks, including bottom navigation and the weekly progress chart.
- Cursor lifecycle checks for settling, pointer leave, reduced motion, disabled mode, touch input, and cleanup.
- Liquid layer checks for which surfaces get a layer (including nested surfaces and open dialogs), theme changes, the Glass toggle, and the CSS fallback after a lost WebGL context.

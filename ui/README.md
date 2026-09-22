# Vocabulary Notebook

A React + Vite vocabulary notebook with a daily dashboard, searchable English/Chinese library, keyboard-friendly review sessions, and progress views. Entries are saved locally in the browser.

## Run

```sh
npm ci
npm run dev
```

`npm run build` creates the production bundle; `npm run preview` serves that bundle. `npm run lint` checks the source.

## Liquid glass

The pointer acts like a small lamp held just above the page. Nothing is drawn at the cursor itself; instead, glass surfaces near it catch the light: the facing bevel brightens with a fine line of refraction at the rim, a fainter reflection appears on the opposite edge, and the frosted face picks up a little scattered light. The highlight tightens as the cursor nears an edge and follows it with a slight, fluid lag. The **Glass** button in the header switches the cursor effect on or off and remembers your choice on this device. On smaller screens, it appears as a sparkle icon.

The effect keeps the native pointer visible and never intercepts clicks. It is disabled on touch/coarse pointers, when reduced motion is requested, and in forced-colors mode. Rendering pauses once the pointer and highlights settle, and resets when the tab is hidden or loses focus.

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

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/*
 * The notebook waits for its fonts before it first renders (src/main.jsx).
 * Without a hint, a browser only asks for a font once the script that needs
 * it has downloaded and run, so the fonts would queue up behind the script.
 * These preload links let them download alongside it. Only the Latin files
 * of the faces the cover and the page open with are preloaded; the others
 * (Latin Extended, Cyrillic) are still fetched only if a page needs them.
 */
const FIRST_FONTS = [
  /dm-sans-latin-(400|500|600)-normal-.*\.woff2$/,
  /caveat-latin-wght-normal-.*\.woff2$/,
]

function preloadFirstFonts() {
  let base = '/'

  return {
    name: 'preload-first-fonts',
    apply: 'build',
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, { bundle }) {
        return Object.keys(bundle ?? {})
          .filter((file) => FIRST_FONTS.some((pattern) => pattern.test(file)))
          .map((file) => ({
            tag: 'link',
            attrs: { rel: 'preload', href: `${base}${file}`, as: 'font', type: 'font/woff2', crossorigin: '' },
            injectTo: 'head',
          }))
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), preloadFirstFonts()],
})

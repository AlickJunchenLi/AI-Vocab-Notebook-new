import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LazyMotion, domAnimation } from 'motion/react'
import '@fontsource-variable/caveat'
import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-500.css'
import '@fontsource/dm-sans/latin-600.css'
import './index.css'
import App from './App.jsx'
import './motion/notebookMotion.css'

/*
 * The first thing on screen is the notebook's cover, with its title set large
 * in DM Sans. A browser only starts downloading a font once some text needs
 * it, so without this the first frames would be drawn in a fallback face and
 * the title would jump to its real size just as the cover began to open.
 * Ask for the fonts straight away and render once they are in, but never wait
 * longer than FONT_WAIT: on a slow connection the page appears anyway and the
 * fonts swap in when they arrive.
 */
const FONT_WAIT = 800
const FACES = [
  '400 1em "DM Sans"',
  '500 1em "DM Sans"',
  '600 1em "DM Sans"',
  '600 1em "Caveat Variable"',
]

function whenFontsReady() {
  if (!document.fonts?.load) return Promise.resolve()
  return Promise.race([
    Promise.all(FACES.map((face) => document.fonts.load(face))),
    new Promise((resolve) => window.setTimeout(resolve, FONT_WAIT)),
  ]).catch(() => {})
}

whenFontsReady().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <LazyMotion features={domAnimation} strict>
        <App />
      </LazyMotion>
    </StrictMode>,
  )
})

/*
 * What an InkField fades in when Handwriting is on, and when. Every visible
 * character fades in on its own, symbols and Chinese characters as much as
 * letters; spaces have nothing to show.
 */

// Grapheme clusters, so an emoji or a letter with its accents is one glyph.
const segmenter = typeof Intl !== "undefined" && Intl.Segmenter
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
  : null;

export function splitGlyphs(text) {
  return segmenter
    ? Array.from(segmenter.segment(text), (part) => part.segment)
    : Array.from(text);
}

export function fadesIn(glyph) {
  return !/^\s+$/u.test(glyph);
}

/*
 * Several glyphs arriving at once (a paste, or a suggestion picked from the
 * list) fade in one after another, like a word being written out, but the
 * whole line never takes much longer than half a second to start.
 */
export function fadeGap(count) {
  return count <= 1 ? 0 : Math.min(40, 560 / count);
}

/*
 * How each character is written in when Handwriting is on (InkField.jsx).
 * Every glyph gets the pen movement a hand would use for it, not only
 * letters: a stroke left to right for most letters and dashes, top to bottom
 * for digits, brackets, bars and quotes, a round sweep for loops like o, @
 * and %, a dab of ink for full stops and commas, a brush sweep from the top
 * left for Chinese and Japanese characters, right to left for Arabic and
 * Hebrew, and a stamp for emoji, which are pasted on rather than drawn.
 * Spaces are not written at all.
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

const STROKES = [
  ["stamp", /\p{Extended_Pictographic}/u],
  ["brush", /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u],
  ["back", /[\p{Script=Arabic}\p{Script=Hebrew}]/u],
  ["dot", /^[.,·•'‘’`´¸。、，．]$/u],
  ["loop", /^[oO0Qq@©®°%&§∞○◯●◎*]$/u],
  ["down", /^[1-9|!¡?¿:;()[\]{}/\\"“”«»‹›^（）「」『』【】《》〈〉：；！？]$/u],
];

// How long each movement takes, in milliseconds.
const DURATIONS = {
  sweep: 200,
  back: 200,
  down: 180,
  dot: 130,
  loop: 280,
  brush: 320,
  stamp: 260,
};

export function strokeFor(glyph) {
  if (/^\s+$/u.test(glyph)) {
    return null;
  }

  return STROKES.find(([, pattern]) => pattern.test(glyph))?.[0] ?? "sweep";
}

export function strokeDuration(stroke) {
  return DURATIONS[stroke] ?? DURATIONS.sweep;
}

/*
 * Several glyphs arriving at once (a paste, or a suggestion picked from the
 * list) are written one after another, like a word written out, but the
 * whole line never takes much longer than half a second to start.
 */
export function strokeGap(count) {
  return count <= 1 ? 0 : Math.min(34, 560 / count);
}

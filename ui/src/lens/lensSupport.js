/*
 * Only Chromium currently resolves url() inside backdrop-filter. Safari and
 * Firefox parse blur() but not the SVG reference, so callers fall back to the
 * frosted pass plus the rim optics rather than rendering nothing.
 */
export const SUPPORTS_BACKDROP_DISPLACEMENT =
  typeof CSS !== "undefined" &&
  typeof CSS.supports === "function" &&
  CSS.supports("backdrop-filter", "url(#lens)");

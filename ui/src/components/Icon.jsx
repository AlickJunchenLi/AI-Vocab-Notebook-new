import ICON_PATHS from "./iconPaths.js";

// The app names its icons; Phosphor drew them (iconPaths.js is generated from
// Phosphor by scripts/build-icons.mjs, with only the two weights used here).
// One weight everywhere keeps the strokes consistent.
function Icon({ name, size = 20, className = "", title, weight = "regular" }) {
  const glyph = ICON_PATHS[name] ?? ICON_PATHS.sparkles;
  const outlines = glyph[weight] ?? glyph.regular;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="currentColor"
      viewBox="0 0 256 256"
      className={["icon", className].filter(Boolean).join(" ")}
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {outlines.map((outline) => <path key={outline} d={outline} />)}
    </svg>
  );
}

export default Icon;

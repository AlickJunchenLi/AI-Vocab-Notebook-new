const ICON_PATHS = {
  "book-open": (
    <>
      <path d="M4 5.75A2.75 2.75 0 0 1 6.75 3H11a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H6.75A2.75 2.75 0 0 0 4 19.75Z" />
      <path d="M24 5.75A2.75 2.75 0 0 0 21.25 3H17a3 3 0 0 0-3 3v14a3 3 0 0 1 3-3h4.25A2.75 2.75 0 0 1 24 19.75Z" />
    </>
  ),
  search: (
    <>
      <circle cx="12.5" cy="12.5" r="7.5" />
      <path d="m18 18 5 5" />
    </>
  ),
  target: (
    <>
      <circle cx="14" cy="14" r="9.5" />
      <circle cx="14" cy="14" r="4" />
      <path d="M14 1v4M27 14h-4M14 27v-4M1 14h4" />
    </>
  ),
  chart: (
    <>
      <path d="M5 24V15M14 24V7M23 24V11" />
      <path d="M2 25.5h24" />
    </>
  ),
  plus: <path d="M14 5v18M5 14h18" />,
  globe: (
    <>
      <circle cx="14" cy="14" r="11" />
      <path d="M3 14h22M14 3c3 3.2 4.5 6.9 4.5 11S17 21.8 14 25M14 3c-3 3.2-4.5 6.9-4.5 11S11 21.8 14 25" />
    </>
  ),
  sort: (
    <>
      <path d="M8 5v18M4 9l4-4 4 4M20 23V5M16 19l4 4 4-4" />
    </>
  ),
  chevron: <path d="m9 11 5 5 5-5" />,
  "chevron-right": <path d="m11 7 7 7-7 7" />,
  more: (
    <>
      <circle cx="6" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="22" cy="14" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  edit: (
    <>
      <path d="m18.5 4.5 5 5L10 23H5v-5Z" />
      <path d="m16 7 5 5" />
    </>
  ),
  trash: (
    <>
      <path d="M5 8h18M11 4h6l1 4M8 8l1 16h10l1-16M12 12v8M16 12v8" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 14s4-7 11.5-7 11.5 7 11.5 7-4 7-11.5 7S2.5 14 2.5 14Z" />
      <circle cx="14" cy="14" r="3" />
    </>
  ),
  "rotate-ccw": (
    <>
      <path d="M5 10V4l-3 3" />
      <path d="M5 7a10 10 0 1 1-1 12" />
    </>
  ),
  frown: (
    <>
      <circle cx="14" cy="14" r="11" />
      <path d="M10 11h.01M18 11h.01M9.5 20c1.2-2 2.7-3 4.5-3s3.3 1 4.5 3" />
    </>
  ),
  smile: (
    <>
      <circle cx="14" cy="14" r="11" />
      <path d="M10 11h.01M18 11h.01M9.5 17c1.2 2 2.7 3 4.5 3s3.3-1 4.5-3" />
    </>
  ),
  check: <path d="m5 14 6 6L23 7" />,
  clock: (
    <>
      <circle cx="14" cy="14" r="11" />
      <path d="M14 8v6l4 2" />
    </>
  ),
  "arrow-up-right": (
    <>
      <path d="M8 20 21 7M11 7h10v10" />
    </>
  ),
  sparkles: (
    <>
      <path d="M14 3c.7 3.4 2.6 5.3 6 6-3.4.7-5.3 2.6-6 6-.7-3.4-2.6-5.3-6-6 3.4-.7 5.3-2.6 6-6Z" />
      <path d="M22 18c.35 1.7 1.3 2.65 3 3-1.7.35-2.65 1.3-3 3-.35-1.7-1.3-2.65-3-3 1.7-.35 2.65-1.3 3-3Z" />
    </>
  ),
  volume: (
    <>
      <path d="M5 16h4l6 5V7l-6 5H5Z" />
      <path d="M19 10c1 1 1.5 2.3 1.5 4S20 17 19 18M22 7c2 2 3 4.3 3 7s-1 5-3 7" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="6" width="20" height="18" rx="3" />
      <path d="M9 3v6M19 3v6M4 11h20M9 16h2M15 16h2M9 20h2M15 20h2" />
    </>
  ),
};

function Icon({ name, size = 20, className = "", title }) {
  const paths = ICON_PATHS[name] ?? ICON_PATHS.sparkles;

  return (
    <svg
      className={["icon", className].filter(Boolean).join(" ")}
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {paths}
    </svg>
  );
}

export default Icon;

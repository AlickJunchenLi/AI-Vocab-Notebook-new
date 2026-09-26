import {
  ArrowCounterClockwise,
  ArrowUpRight,
  ArrowsDownUp,
  BookOpen,
  CalendarBlank,
  CaretDown,
  CaretRight,
  ChartBar,
  Check,
  Clock,
  DotsThree,
  Eye,
  Fire,
  Globe,
  MagnifyingGlass,
  Moon,
  PencilSimple,
  Plus,
  SlidersHorizontal,
  Smiley,
  SmileySad,
  Sparkle,
  SpeakerHigh,
  Star,
  Sun,
  Target,
  Trash,
  X,
} from "@phosphor-icons/react";

// The app names its icons; Phosphor draws them. One weight everywhere keeps
// the strokes consistent.
const ICONS = {
  "arrow-up-right": ArrowUpRight,
  "book-open": BookOpen,
  calendar: CalendarBlank,
  chart: ChartBar,
  check: Check,
  chevron: CaretDown,
  "chevron-right": CaretRight,
  clock: Clock,
  edit: PencilSimple,
  eye: Eye,
  flame: Fire,
  frown: SmileySad,
  globe: Globe,
  moon: Moon,
  more: DotsThree,
  plus: Plus,
  "rotate-ccw": ArrowCounterClockwise,
  search: MagnifyingGlass,
  sliders: SlidersHorizontal,
  smile: Smiley,
  sort: ArrowsDownUp,
  sparkles: Sparkle,
  star: Star,
  sun: Sun,
  target: Target,
  trash: Trash,
  volume: SpeakerHigh,
  x: X,
};

function Icon({ name, size = 20, className = "", title, weight = "regular" }) {
  const Glyph = ICONS[name] ?? Sparkle;

  return (
    <Glyph
      className={["icon", className].filter(Boolean).join(" ")}
      size={size}
      weight={weight}
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
      alt={title}
    />
  );
}

export default Icon;

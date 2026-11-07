import type { SVGProps } from "react";

export type GlyphName =
  | "search"
  | "close"
  | "plus"
  | "minus"
  | "check"
  | "chevron-down"
  | "chevron-right"
  | "chevron-left"
  | "external"
  | "filter"
  | "sort"
  | "more"
  | "menu"
  | "copy"
  | "link"
  | "calendar"
  | "clock"
  | "install"
  | "share";

/* Every drawing fits a 20px box with a 2px margin (drawing area 3 to 17), hairline 1.5, round caps and joins, no fills.
   "more" is three zero length round capped strokes at 2.5, which read as dots. */
const PATHS: Record<GlyphName, string> = {
  search: "M9 4a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12.5 12.5L16.5 16.5",
  close: "M5 5L15 15M15 5L5 15",
  plus: "M10 4v12M4 10h12",
  minus: "M4 10h12",
  check: "M4 10.5L8.5 15L16 6",
  "chevron-down": "M5 8l5 5 5-5",
  "chevron-right": "M8 5l5 5-5 5",
  "chevron-left": "M12 5l-5 5 5 5",
  external: "M9 4H4v12h12v-5M10 10L16 4M12 4h4v4",
  filter: "M4 6h12M6 10h8M8 14h4",
  sort: "M7 16V4M4 7l3-3 3 3M13 4v12M10 13l3 3 3-3",
  more: "M5 10h.01M10 10h.01M15 10h.01",
  menu: "M4 6h12M4 10h12M4 14h12",
  copy: "M13 7V4H4v9h3M7 7h9v9H7z",
  link: "M9 11a2.5 2.5 0 0 0 3.5 0l2.5-2.5a2.5 2.5 0 0 0-3.5-3.5L10.5 6M11 9a2.5 2.5 0 0 0-3.5 0L5 11.5a2.5 2.5 0 0 0 3.5 3.5L9.5 14",
  calendar: "M4 6h12v11H4zM7 4v3M13 4v3M4 9h12",
  clock: "M10 3.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13M10 6.5V10l2.5 2",
  install: "M10 4v9M6 9l4 4 4-4M4 16h12",
  share: "M10 13V4M6 8l4-4 4 4M4 11v5h12v-5",
};

/** A 20px hairline glyph. Decorative unless given a label. Never a target on its own. */
export function Glyph({ name, label, className, ...rest }: { name: GlyphName; label?: string; className?: string } & SVGProps<SVGSVGElement>) {
  const cls = ["ig-glyph", className].filter(Boolean).join(" ");
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <svg
      className={cls}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "more" ? 2.5 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...a11y}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The dot arrow, 13 by 13, six circles r 1.5, fill currentColor. Used by Button only. */
export function DotArrow({ className }: { className?: string }) {
  const cls = ["ig-dot-arrow", className].filter(Boolean).join(" ");
  return (
    <svg className={cls} width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden="true">
      <circle cx="1.5" cy="1.5" r="1.5" />
      <circle cx="1.5" cy="6.5" r="1.5" />
      <circle cx="1.5" cy="11.5" r="1.5" />
      <circle cx="6.5" cy="4" r="1.5" />
      <circle cx="6.5" cy="9" r="1.5" />
      <circle cx="11.5" cy="6.5" r="1.5" />
    </svg>
  );
}

/** 8 by 8 delta caret: up, down (the same shape rotated 180deg), flat (a 6 by 1 rule). Used by MetricStrip, with a hidden word beside it. */
export function Caret({ direction, className }: { direction: "up" | "down" | "flat"; className?: string }) {
  const cls = ["ig-caret", `ig-caret--${direction}`, className].filter(Boolean).join(" ");
  return (
    <svg className={cls} width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true" style={direction === "down" ? { rotate: "180deg" } : undefined}>
      {direction === "flat" ? <rect x="1" y="3.5" width="6" height="1" /> : <path d="M4 1 L7 6 L1 6 Z" />}
    </svg>
  );
}

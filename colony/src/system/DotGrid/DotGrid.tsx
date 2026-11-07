import { useRef, type CSSProperties } from "react";
import { useReducedMotion } from "motion/react";

/* The lit point array every dot mark in Colony is drawn from: the tab bar marks, the companion, the jar, the Mark,
   the empty state glyph. Dots never move: every mood is a cross fade of opacity or fill between two lit sets. */

export type GridSize = "sm" | "md" | "lg";
export type PatternName = "none" | "full" | "plus" | "cross" | "ring" | "center" | "rise" | "forward" | "colony";
export type UnlitStyle = "faint" | "surface" | "dim" | "none";
export type SettleOrder = "center" | "reading" | "clockwise";

/* sm: 20px box, 3 by 3, 8px pitch (centers 2, 10, 18). md: 44px, 5 by 5, 10px pitch (2 to 42). lg: 84px, 9 by 9, 10px pitch (2 to 82). r 2 throughout. */
const GEOM: Record<GridSize, { box: number; n: number; pitch: number }> = {
  sm: { box: 20, n: 3, pitch: 8 },
  md: { box: 44, n: 5, pitch: 10 },
  lg: { box: 84, n: 9, pitch: 10 },
};

/** The binding lit index arrays on the 3 by 3, row major 0 to 8. No other file draws a pattern. */
export const PATTERNS_SM: Record<PatternName, number[]> = {
  none: [],
  full: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  plus: [1, 3, 4, 5, 7],
  cross: [0, 2, 4, 6, 8],
  ring: [0, 1, 2, 3, 5, 6, 7, 8],
  center: [4],
  rise: [6, 4, 2],
  forward: [3, 4, 5, 2],
  colony: [0, 1, 2, 3, 5, 6, 7, 8],
};

/* md and lg scale each pattern by one rule: full all; plus the middle row and column; cross both diagonals;
   ring and colony the perimeter; center the middle dot (md) or the middle 3 by 3 (lg); rise the main diagonal
   from bottom left; forward the middle row plus the two cells above and below its last cell. */
function scaled(name: PatternName, size: GridSize): boolean[] {
  const { n } = GEOM[size];
  const mid = (n - 1) / 2;
  const out: boolean[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      let on = false;
      switch (name) {
        case "none": on = false; break;
        case "full": on = true; break;
        case "plus": on = r === mid || c === mid; break;
        case "cross": on = r === c || r + c === n - 1; break;
        case "ring":
        case "colony": on = r === 0 || r === n - 1 || c === 0 || c === n - 1; break;
        case "center": on = size === "lg" ? Math.abs(r - mid) <= 1 && Math.abs(c - mid) <= 1 : r === mid && c === mid; break;
        case "rise": on = r + c === n - 1; break;
        case "forward": on = r === mid || (c === n - 1 && Math.abs(r - mid) === 1); break;
      }
      out.push(on);
    }
  }
  return out;
}

function fromSm(name: PatternName): boolean[] {
  const set = new Set(PATTERNS_SM[name]);
  return Array.from({ length: 9 }, (_, i) => set.has(i));
}

const NAMES: PatternName[] = ["none", "full", "plus", "cross", "ring", "center", "rise", "forward", "colony"];

/** Row major lit arrays, length 9, 25 or 81. sm reads PATTERNS_SM; md and lg are derived by the scaling rule. */
export const PATTERNS: Record<PatternName, (size: GridSize) => boolean[]> = Object.fromEntries(
  NAMES.map((name) => [name, (size: GridSize) => (size === "sm" ? fromSm(name) : scaled(name, size))]),
) as Record<PatternName, (size: GridSize) => boolean[]>;

/** A count lit bottom row first, left to right: a vessel fills from the bottom. */
function litFromCount(count: number, n: number): boolean[] {
  const out: boolean[] = Array(n * n).fill(false);
  const k = Math.max(0, Math.min(n * n, Math.round(count)));
  for (let i = 0; i < k; i++) {
    const row = n - 1 - Math.floor(i / n);
    const col = i % n;
    out[row * n + col] = true;
  }
  return out;
}

function resolveLit(size: GridSize, pattern: PatternName, lit: number | boolean[] | undefined): boolean[] {
  const { n } = GEOM[size];
  if (typeof lit === "number") return litFromCount(lit, n);
  if (Array.isArray(lit)) return Array.from({ length: n * n }, (_, i) => Boolean(lit[i]));
  return PATTERNS[pattern](size);
}

/** Chebyshev distance from the center: the ring a dot sits on. */
function chebyshev(i: number, n: number): number {
  const mid = (n - 1) / 2;
  return Math.max(Math.abs(Math.floor(i / n) - mid), Math.abs((i % n) - mid));
}

/** Ranks for settle delays. center: the ring; reading: the index; clockwise: the lit dots in angle order from 12 o'clock. */
function ranks(order: SettleOrder, lit: boolean[], n: number): number[] {
  if (order === "reading") return lit.map((_, i) => i);
  if (order === "center") return lit.map((_, i) => chebyshev(i, n));
  const mid = (n - 1) / 2;
  const angle = (i: number) => {
    const dx = (i % n) - mid;
    const dy = Math.floor(i / n) - mid;
    const a = Math.atan2(dx, -dy);
    return a < 0 ? a + Math.PI * 2 : a;
  };
  const dist = (i: number) => Math.hypot((i % n) - mid, Math.floor(i / n) - mid);
  const litIdx = lit.map((on, i) => (on ? i : -1)).filter((i) => i >= 0);
  litIdx.sort((a, b) => angle(a) - angle(b) || dist(a) - dist(b));
  const out = lit.map(() => 0);
  litIdx.forEach((i, rank) => {
    out[i] = rank;
  });
  return out;
}

interface Dot {
  key: string | number;
  lit: boolean;
  style: CSSProperties;
  fresh?: "true" | "out";
}

function Grid({
  size,
  dots,
  unlit,
  modifiers,
  label,
  className,
  style,
}: {
  size: GridSize;
  dots: Dot[];
  unlit: UnlitStyle;
  modifiers: string[];
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const { box, n, pitch } = GEOM[size];
  const cls = ["ig-dotgrid", `ig-dotgrid--${size}`, unlit !== "faint" ? `ig-dotgrid--unlit-${unlit}` : "", ...modifiers, className].filter(Boolean).join(" ");
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <svg className={cls} viewBox={`0 0 ${box} ${box}`} width={box} height={box} style={style} {...a11y}>
      {dots.map((d, i) => (
        <circle
          key={d.key}
          className="ig-dotgrid__dot"
          data-lit={d.lit ? "true" : "false"}
          data-fresh={d.fresh}
          cx={2 + (i % n) * pitch}
          cy={2 + Math.floor(i / n) * pitch}
          r="2"
          style={d.style}
        />
      ))}
    </svg>
  );
}

export function DotGrid({
  size = "sm",
  pattern = "none",
  lit,
  unlit = "faint",
  settle,
  settleOrder = "center",
  ambient,
  label,
  className,
  style,
}: {
  size?: GridSize;
  /** named lit set; ignored when lit is given */
  pattern?: PatternName;
  /** a count (filled bottom row first, left to right) or an explicit array */
  lit?: number | boolean[];
  /** faint: neutral-02 (default); surface: the tab bar; dim: currentColor at 0.25 (inverted grounds); none: not drawn */
  unlit?: UnlitStyle;
  /** lit dots scale in, one settle step apart (30ms; set --ig-settle-step to change it), ig-settle keyframes */
  settle?: boolean;
  /** which dot goes first: center (the ring rank, default), reading (the index), clockwise from 12 o'clock */
  settleOrder?: SettleOrder;
  /** cross fade pattern <-> ambient every 2400ms with a center ripple (ig-ambient) */
  ambient?: PatternName;
  /** adds role="img" aria-label; otherwise aria-hidden */
  label?: string;
  className?: string;
  /** inline custom properties only (--ig-settle-step for a slower or faster settle) */
  style?: CSSProperties;
}) {
  const reduced = useReducedMotion();
  const { n } = GEOM[size];
  const a = resolveLit(size, pattern, lit);
  const b = ambient && !reduced ? PATTERNS[ambient](size) : null;
  const settling = Boolean(settle) && !reduced;
  const settleRank = settling ? ranks(settleOrder, a, n) : null;
  const dots: Dot[] = a.map((on, i) => {
    const vars: Record<string, number> = {};
    if (settleRank) vars["--i"] = settleRank[i];
    if (b) {
      vars["--r"] = chebyshev(i, n);
      vars["--a"] = on ? 1 : 0.25;
      vars["--b"] = b[i] ? 1 : 0.25;
    }
    return { key: i, lit: on || (b ? b[i] : false), style: vars as CSSProperties };
  });
  const modifiers = [settling ? "ig-dotgrid--settle" : "", b ? "ig-dotgrid--ambient" : ""];
  return <Grid size={size} dots={dots} unlit={unlit} modifiers={modifiers} label={label} className={className} style={style} />;
}

/** 20px 3 by 3 mark for tab bars and rows. Same as <DotGrid size="sm" pattern={pattern} />. */
export function AmbientIcon({
  pattern,
  unlit = "faint",
  settle,
  settleOrder,
  className,
}: {
  pattern: PatternName;
  unlit?: UnlitStyle;
  settle?: boolean;
  settleOrder?: SettleOrder;
  className?: string;
}) {
  return <DotGrid size="sm" pattern={pattern} unlit={unlit} settle={settle} settleOrder={settleOrder} className={className} />;
}

/** lit = round(clamp(cents / maxCents, 0.04, 1) * dots), min 1 when cents > 0, 0 otherwise. */
export function jarCount(cents: number, maxCents: number, dots: number): number {
  if (!(cents > 0)) return 0;
  const frac = maxCents > 0 ? cents / maxCents : 1;
  return Math.max(1, Math.round(Math.max(0.04, Math.min(1, frac)) * dots));
}

/* The settle step, in ms, for a relight: 30ms apart, compressed so the whole run never exceeds 240ms. */
const SETTLE_STEP_MS = 30;
const SETTLE_TOTAL_MS = 240;

/** The pool: a grid that fills from the bottom. Only the newly lit dots settle in on change; animate false renders the final state. */
export function Jar({
  cents,
  maxCents,
  size = "md",
  animate = true,
  label,
  className,
}: {
  cents: number;
  maxCents: number;
  size?: "md" | "lg";
  animate?: boolean;
  /** "Pool at {percent} percent of {max}", built by the caller because the money format lives in the domain */
  label?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const { n } = GEOM[size];
  const count = jarCount(cents, maxCents, n * n);
  const lit = litFromCount(count, n);
  /* What changed since the last count: the fresh set is kept until the count changes again, so a re render mid animation does not restart it. */
  const memo = useRef<{ count: number; fresh: Map<number, number>; out: Set<number>; gen: number }>({ count, fresh: new Map(), out: new Set(), gen: 0 });
  if (memo.current.count !== count) {
    const prev = litFromCount(memo.current.count, n);
    const fresh = new Map<number, number>();
    const out = new Set<number>();
    lit.forEach((on, i) => {
      if (on && !prev[i]) fresh.set(i, fresh.size);
      if (!on && prev[i]) out.add(i);
    });
    memo.current = { count, fresh, out, gen: memo.current.gen + 1 };
  }
  const { fresh, out, gen } = memo.current;
  const live = animate && !reduced;
  const step = fresh.size > 1 ? Math.min(SETTLE_STEP_MS, SETTLE_TOTAL_MS / (fresh.size - 1)) : SETTLE_STEP_MS;
  const dots: Dot[] = lit.map((on, i) => {
    const isFresh = live && fresh.has(i);
    const isOut = live && out.has(i);
    return {
      key: isFresh ? `${i}-${gen}` : i,
      lit: on,
      style: isFresh ? ({ "--i": fresh.get(i) } as CSSProperties) : {},
      fresh: isFresh ? "true" : isOut ? "out" : undefined,
    };
  });
  const style = live ? ({ "--ig-settle-step": `${step}ms` } as CSSProperties) : undefined;
  return <Grid size={size} dots={dots} unlit="faint" modifiers={[live ? "ig-dotgrid--relight" : ""]} label={label} className={["ig-jar", className].filter(Boolean).join(" ")} style={style} />;
}

import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { MetaLine } from "@/system/MetaLine/MetaLine";
import { MetricStrip, type MetricItem } from "@/system/MetricStrip/MetricStrip";
import { dur, ease, stag, useReducedMotion } from "@/system/motion";

/* The tokens specimens. Every value shown is read from the computed style of this section's own root, so the library's
   dark switch (data-mode on the wrapper above) shows the mirrored ladder without a second table of values. */

const COLORS = ["surface", "neutral-10", "neutral-09", "neutral-08", "neutral-06", "neutral-04", "neutral-02", "neutral-01", "accent-red", "accent-green"] as const;

const TYPES = [
  "headline-large",
  "headline-medium",
  "headline-small",
  "paragraph-large",
  "paragraph-medium",
  "paragraph-small",
  "paragraph-x-small",
  "label-large",
  "label-small",
] as const;

const SPACING = ["x-small", "small", "med", "large", "x-large"] as const;

const RADII = ["small", "med", "large"] as const;

type Curve = readonly [number, number, number, number];

const EASES: { label: string; token: string; curve: Curve }[] = [
  { label: "neutral", token: "--ease-neutral", curve: ease.neutral },
  { label: "enter", token: "--ease-enter", curve: ease.enter },
  { label: "exit", token: "--ease-exit", curve: ease.exit },
  { label: "standard", token: "--ease-standard", curve: ease.standard },
  { label: "feature reveal", token: "--ease-feature-reveal", curve: ease.featureReveal },
  { label: "expressive", token: "--ease-expressive", curve: ease.expressive },
  { label: "editorial", token: "--ease-editorial", curve: ease.editorial },
  { label: "line draw", token: "--ease-line-draw", curve: ease.lineDraw },
  { label: "node", token: "--ease-node", curve: ease.node },
  { label: "node exit", token: "--ease-node-exit", curve: ease.nodeExit },
  { label: "signal", token: "--ease-signal", curve: ease.signal },
];

/* The eight duration tokens and the four staggers, with the motion.ts value (in ms) as the fallback before the first read. */
const DURATIONS: { label: string; token: string; fallback: number }[] = [
  { label: "Instant", token: "--motion-duration-instant", fallback: dur.instant * 1000 },
  { label: "Fast", token: "--motion-fast", fallback: dur.fast * 1000 },
  { label: "Normal", token: "--motion-normal", fallback: dur.normal * 1000 },
  { label: "Exit short", token: "--motion-duration-exit", fallback: dur.exitShort * 1000 },
  { label: "Exit", token: "--motion-exit", fallback: dur.exit * 1000 },
  { label: "Slow", token: "--motion-duration-slow", fallback: dur.slow * 1000 },
  { label: "Entrance", token: "--motion-entrance", fallback: dur.entrance * 1000 },
  { label: "Hero", token: "--motion-duration-hero", fallback: dur.hero * 1000 },
  { label: "Stagger xs", token: "--motion-stagger-xs", fallback: stag.xs * 1000 },
  { label: "Stagger sm", token: "--motion-stagger-sm", fallback: stag.sm * 1000 },
  { label: "Stagger md", token: "--motion-stagger-md", fallback: stag.md * 1000 },
  { label: "Stagger lg", token: "--motion-stagger-lg", fallback: stag.lg * 1000 },
];

const SAMPLE = "Everyone has a role. Each one is vital.";

/** Every token this section shows, read once from the root's computed style. */
function readTokens(root: HTMLElement): Record<string, string> {
  const style = getComputedStyle(root);
  const out: Record<string, string> = {};
  const read = (name: string) => {
    out[name] = style.getPropertyValue(name).trim().replace(/^["']|["']$/g, "");
  };
  for (const c of COLORS) read(`--color-${c}`);
  for (const t of TYPES) for (const part of ["family", "weight", "size", "line-height", "tracking"]) read(`--type-${t}-${part}`);
  for (const s of SPACING) read(`--padding-${s}`);
  for (const r of RADII) read(`--radius-${r}`);
  for (const d of DURATIONS) read(d.token);
  for (const e of EASES) read(e.token);
  return out;
}

/** A missing value is "-", never 0 (rule 16). */
const show = (value: string | undefined) => (value === undefined || value === "" ? "-" : value.replace(/(^|-)\./, "$10."));   /* ".01em" reads as "0.01em" */

/** One easing tile: the curve as a hairline in a 44px square (Recipe A: the tile is the button), a 4px track under it,
 *  and a 5px dot that runs across on that curve over the entrance duration when tapped. Reduced motion shows the final frame. */
function EaseTile({ label, token, curve, value }: { label: string; token: string; curve: Curve; value: string | undefined }) {
  const reduced = useReducedMotion();
  const track = useRef<HTMLSpanElement>(null);
  const [run, setRun] = useState(0);
  const [travel, setTravel] = useState(0);
  const [x1, y1, x2, y2] = curve;
  /* the drawing area is 2 to 42 inside the 44 box; y grows downward, so the curve's y is flipped */
  const d = `M2 42 C ${2 + x1 * 40} ${42 - y1 * 40}, ${2 + x2 * 40} ${42 - y2 * 40}, 42 2`;
  const start = () => {
    const width = track.current?.getBoundingClientRect().width ?? 0;
    const dot = track.current?.firstElementChild?.getBoundingClientRect().width ?? 0;
    setTravel(Math.max(0, width - dot));
    setRun((r) => r + 1);
  };
  return (
    <div className="ig-ease">
      <button type="button" className="ig-ease__tile" onClick={start} aria-label={`Run the ${label} curve`} title={`${token}: ${show(value)}`}>
        <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true" focusable="false">
          <path className="ig-ease__guide" d="M2 42L42 2" strokeWidth="1" />
          <path className="ig-ease__curve" d={d} strokeWidth="1" strokeLinecap="round" />
        </svg>
      </button>
      <span className="ig-ease__track" ref={track} aria-hidden="true">
        <motion.span
          key={run}
          className="ig-ease__dot"
          initial={{ x: 0 }}
          animate={{ x: run > 0 ? travel : 0 }}
          transition={reduced ? { duration: 0 } : { duration: dur.entrance, ease: curve as [number, number, number, number] }}
        />
      </span>
      <span className="ig-ease__name label-small">{token.replace("--ease-", "")}</span>
    </div>
  );
}

/** The tokens panel body: color, type, spacing, radius, easing, durations and staggers. mode re reads the values when the wrapper flips. */
export function TokensSection({ mode }: { mode: "light" | "dark" }) {
  const root = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  useLayoutEffect(() => {
    if (!root.current) return;
    setValues(readTokens(root.current));
  }, [mode]);

  /* the computed value may come back in seconds ("0.1s") or milliseconds ("100ms"); the figure is always ms */
  const ms = (token: string, fallback: number) => {
    const raw = (values[token] ?? "").trim();
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return fallback;
    return /ms$/i.test(raw) ? n : /s$/i.test(raw) ? Math.round(n * 1000) : n;
  };
  const durations: MetricItem[] = DURATIONS.map((d) => ({ label: d.label, value: ms(d.token, d.fallback), unit: "MS" }));

  return (
    <div className="ig-tokens" ref={root}>
      <section className="ig-tokens__block" aria-label="Color">
        <h3 className="ig-tokens__head label-small">Color</h3>
        <ul className="ig-tokens__colors">
          {COLORS.map((c) => (
            <li className="ig-tokens__swatch" key={c}>
              <span className="ig-tokens__chip" style={{ background: `var(--color-${c})` }} aria-hidden="true" />
              <span className="ig-tokens__name label-small">{c}</span>
              <span className="ig-tokens__value label-small">{show(values[`--color-${c}`])}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="ig-tokens__block" aria-label="Type">
        <h3 className="ig-tokens__head label-small">Type</h3>
        <ul className="ig-tokens__type">
          {TYPES.map((t) => (
            <li className="ig-tokens__type-row" key={t}>
              <p className={`ig-tokens__sample ${t}`}>{SAMPLE}</p>
              <MetaLine
                className="ig-tokens__quintet"
                facts={[
                  t,
                  show(values[`--type-${t}-family`]),
                  show(values[`--type-${t}-weight`]),
                  show(values[`--type-${t}-size`]),
                  show(values[`--type-${t}-line-height`]),
                  show(values[`--type-${t}-tracking`]),
                ]}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="ig-tokens__block" aria-label="Spacing">
        <h3 className="ig-tokens__head label-small">Spacing</h3>
        <ul className="ig-tokens__spacing">
          {SPACING.map((s) => (
            <li className="ig-tokens__space" key={s}>
              <span className="ig-tokens__bar" style={{ width: `var(--padding-${s})`, height: `var(--padding-${s})` }} aria-hidden="true" />
              <span className="ig-tokens__name label-small">{`padding ${s}`}</span>
              <span className="ig-tokens__value label-small">{show(values[`--padding-${s}`])}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="ig-tokens__block" aria-label="Radius">
        <h3 className="ig-tokens__head label-small">Radius</h3>
        <ul className="ig-tokens__radii">
          {RADII.map((r) => (
            <li className="ig-tokens__space" key={r}>
              <span className="ig-tokens__radius-box" style={{ borderRadius: `var(--radius-${r})` }} aria-hidden="true" />
              <span className="ig-tokens__name label-small">{`radius ${r}`}</span>
              <span className="ig-tokens__value label-small">{show(values[`--radius-${r}`])}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="ig-tokens__block" aria-label="Easing">
        <h3 className="ig-tokens__head label-small">Easing</h3>
        <p className="ig-tokens__note paragraph-x-small">Tap a curve to run a dot across its track.</p>
        <div className="ig-tokens__eases">
          {EASES.map((e) => (
            <EaseTile key={e.token} label={e.label} token={e.token} curve={e.curve} value={values[e.token]} />
          ))}
        </div>
      </section>

      <section className="ig-tokens__block" aria-label="Durations and staggers">
        <h3 className="ig-tokens__head label-small">Durations and staggers</h3>
        <MetricStrip items={durations} columns={2} />
      </section>
    </div>
  );
}

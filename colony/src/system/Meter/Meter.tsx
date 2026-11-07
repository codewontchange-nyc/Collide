import { useEffect, useState } from "react";
import { useReducedMotion } from "@/system/motion";

export type MeterKey = "direct" | "pool" | "one" | "two";

export interface MeterPart {
  key: MeterKey;
  value: number;
  /** the legend word, with the figure in it ("Direct $3,520"); the split is said in words, never by hue */
  label?: string;
}

/** The 4px track with up to two series and a swatch legend. Widths are value / sum, or value / max for a single ranked bar.
 *  highlight: in a ranked set the caller passes true on the top bar and false on the rest, which go neutral-04. */
export function Meter({
  parts,
  max,
  legend,
  highlight,
  label,
  className,
}: {
  parts: MeterPart[];
  max?: number;
  legend?: boolean;
  highlight?: boolean;
  label: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  /* widths start at 0 and grow over the normal duration once mounted; reduced motion renders the final frame */
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const sum = parts.reduce((acc, p) => acc + Math.max(0, p.value), 0);
  const total = max !== undefined ? max : sum;
  const pct = (value: number) => (total > 0 ? Math.max(0, Math.min(100, (Math.max(0, value) / total) * 100)) : 0);
  const showLegend = legend ?? parts.some((p) => p.label);
  const first = parts[0] ? Math.round(pct(parts[0].value)) : 0;
  const cls = ["ig-meter", className].filter(Boolean).join(" ");
  const ready = grown || reduced;
  return (
    <div className={cls} data-highlight={highlight === undefined ? undefined : highlight ? "true" : "false"}>
      <div className="ig-meter__track" role="progressbar" aria-label={label} aria-valuenow={first} aria-valuemin={0} aria-valuemax={100}>
        {parts.map((p) => (
          <span key={p.key} className={`ig-meter__fill ig-meter__fill--${p.key}`} style={{ width: `${ready ? pct(p.value) : 0}%` }} />
        ))}
      </div>
      {showLegend && (
        <ul className="ig-meter__legend label-small">
          {parts
            .filter((p) => p.label)
            .map((p) => (
              <li key={p.key} className="ig-meter__key">
                <i className={`ig-meter__swatch ig-meter__swatch--${p.key}`} aria-hidden="true" />
                {p.label}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

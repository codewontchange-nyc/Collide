import type { ReactNode } from "react";
import { Caret } from "@/system/Glyph/Glyph";

export interface MetricItem {
  label: string;
  value: ReactNode;
  unit?: string;
  /** direction is the caret and a hidden word; deltas never color */
  delta?: { text: string; direction: "up" | "down" | "flat" };
  note?: string;
}

/** The figures under the title: label over a 32px numeral, ink rule on top, hairline under each item.
 *  columns 2 keeps two figures side by side at 343px; 1 stacks; omitted is the kit's auto fit (two columns from 352px). */
export function MetricStrip({
  items,
  variant = "strip",
  columns,
  className,
}: {
  items: MetricItem[];
  variant?: "strip" | "tiles";
  columns?: 1 | 2;
  className?: string;
}) {
  const cls = ["ig-metric-strip", `ig-metric-strip--${variant}`, columns ? `ig-metric-strip--cols-${columns}` : "", className].filter(Boolean).join(" ");
  return (
    <dl className={cls}>
      {items.map((item, i) => (
        <div className="ig-metric-strip__item" key={i}>
          <dt className="ig-metric-strip__label label-small">{item.label}</dt>
          <dd className="ig-metric-strip__figure">
            <span className="ig-metric-strip__value headline-medium tnum">{item.value}</span>
            {item.unit && <span className="ig-metric-strip__unit label-small">{item.unit}</span>}
          </dd>
          {item.delta && (
            <dd className="ig-metric-strip__delta paragraph-x-small">
              <Caret direction={item.delta.direction} />
              <span className="ig-sr">{item.delta.direction} </span>
              {item.delta.text}
            </dd>
          )}
          {item.note && <dd className="ig-metric-strip__note paragraph-x-small">{item.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

import type { ReactNode } from "react";

/** Label over the hero numeral. Renders a dt and a dd, so it always sits inside a dl. One hero number per screen.
 *  Unboxed at page level; the library's boxed form adds className "ig-stat-tile--boxed". */
export function StatTile({ label, value, unit, className }: { label?: string; value: ReactNode; unit?: string; className?: string }) {
  const cls = ["ig-stat-tile", className].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      {label && <dt className="ig-stat-tile__label headline-small">{label}</dt>}
      <dd className="ig-stat-tile__figure">
        <span className="ig-stat-tile__value headline-large tnum">{value}</span>
        {unit && <span className="ig-stat-tile__unit label-small">{unit}</span>}
      </dd>
    </div>
  );
}

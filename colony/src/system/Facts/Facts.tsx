import type { ReactNode } from "react";

export interface FactItem {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
}

/** Label over value, two columns. Falsy items are skipped so a caller can include one conditionally. Not pressable. */
export function Facts({ items, columns = 2, className }: { items: (FactItem | false | undefined | null)[]; columns?: 1 | 2; className?: string }) {
  const shown = items.filter((it): it is FactItem => Boolean(it));
  const cls = ["ig-facts", columns === 1 ? "ig-facts--cols-1" : "", className].filter(Boolean).join(" ");
  return (
    <dl className={cls}>
      {shown.map((it, i) => (
        <div className="ig-facts__item" key={i}>
          <dt className="ig-facts__label label-small">{it.label}</dt>
          <dd className="ig-facts__value paragraph-small">{it.value}</dd>
          {it.meta !== undefined && it.meta !== null && it.meta !== false && <dd className="ig-facts__meta label-small">{it.meta}</dd>}
        </div>
      ))}
    </dl>
  );
}

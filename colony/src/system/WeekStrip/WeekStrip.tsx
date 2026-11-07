export interface WeekDay {
  /** the date key the caller selects by ("2026-11-05") */
  date: string;
  /** "MON" */
  weekday: string;
  number: number;
  relation: "past" | "today" | "future";
  busy?: boolean;
  /** the accessible day name ("Thursday, Nov 5, two things") */
  label?: string;
}

/** Seven day cells: a mono day name over the date, a 3px mark when the day holds something. Today is the inverted cell.
 *  With onSelect each day is a 44px button named by label; without it the cell is a span, and the label is read from a visually
 *  hidden span inside it (aria-label on a generic span is not exposed), with the visible name and number hidden from the reader. */
export function WeekStrip({
  days,
  onSelect,
  selected,
  label = "This week",
  className,
}: {
  days: WeekDay[];
  onSelect?: (date: string) => void;
  selected?: string;
  label?: string;
  className?: string;
}) {
  const cls = ["ig-week", className].filter(Boolean).join(" ");
  return (
    <ol className={cls} aria-label={label}>
      {days.map((d) => {
        const isSelected = selected !== undefined && selected === d.date;
        /* in the span form the visible parts are hidden from the reader when a label names the day */
        const hideVisible = !onSelect && d.label !== undefined;
        const inner = (
          <>
            <span className="ig-week__name label-small" aria-hidden={hideVisible || undefined}>
              {d.weekday}
            </span>
            <span className="ig-week__num headline-small tnum" aria-hidden={hideVisible || undefined}>
              {d.number}
            </span>
            <span className="ig-week__mark" data-busy={d.busy ? "true" : "false"} />
          </>
        );
        const shared = {
          className: "ig-week__day",
          "data-relation": d.relation,
          "data-selected": isSelected ? "true" : undefined,
          "aria-current": d.relation === "today" ? ("date" as const) : undefined,
        };
        return (
          <li className="ig-week__item" key={d.date}>
            {onSelect ? (
              <button type="button" {...shared} aria-label={d.label} aria-pressed={isSelected} onClick={() => onSelect(d.date)}>
                {inner}
              </button>
            ) : (
              <span {...shared}>
                {d.label !== undefined && <span className="ig-sr">{d.label}</span>}
                {inner}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

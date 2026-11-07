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
 *  With onSelect each day is a 44px button. No counts: a quiet week is a row of bare dates. */
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
        const inner = (
          <>
            <span className="ig-week__name label-small">{d.weekday}</span>
            <span className="ig-week__num headline-small tnum">{d.number}</span>
            <span className="ig-week__mark" data-busy={d.busy ? "true" : "false"} />
          </>
        );
        const shared = {
          className: "ig-week__day",
          "data-relation": d.relation,
          "data-selected": isSelected ? "true" : undefined,
          "aria-current": d.relation === "today" ? ("date" as const) : undefined,
          "aria-label": d.label,
        };
        return (
          <li className="ig-week__item" key={d.date}>
            {onSelect ? (
              <button type="button" {...shared} aria-pressed={isSelected} onClick={() => onSelect(d.date)}>
                {inner}
              </button>
            ) : (
              <span {...shared}>{inner}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

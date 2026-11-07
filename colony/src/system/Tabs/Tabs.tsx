import { useId, useRef, type KeyboardEvent } from "react";

export type TabSpec = { label: string; count?: number; id?: string };

/** Views, not filters. Roving tabindex: the selected tab is in the tab order, arrows move and select, Home and End jump.
 *  Panels: the caller gives id per tab and sets role="tabpanel" aria-labelledby={id} id={`${id}-panel`} on its content. */
export function Tabs({
  tabs,
  value,
  onChange,
  label,
  fill = true,
  scroll = false,
  className,
}: {
  tabs: TabSpec[];
  value: number;
  onChange: (index: number) => void;
  /** names the tablist, required */
  label: string;
  /** tabs flex: 1 to fill the column (default true on a phone) */
  fill?: boolean;
  /** instead of fill: nowrap, scrolls in the gutter bleed */
  scroll?: boolean;
  className?: string;
}) {
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrolling = scroll;
  const filling = fill && !scroll;
  const cls = ["ig-tabs", scrolling ? "ig-tabs--scroll" : "", filling ? "ig-tabs--fill" : "", className].filter(Boolean).join(" ");

  const select = (index: number) => {
    const n = tabs.length;
    const next = ((index % n) + n) % n;
    if (next !== value) onChange(next);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        select(value + 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        select(value - 1);
        break;
      case "Home":
        e.preventDefault();
        select(0);
        break;
      case "End":
        e.preventDefault();
        select(tabs.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div className={cls} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab, i) => {
        const id = tab.id ?? `${base}-tab-${i}`;
        const selected = i === value;
        return (
          <button
            key={id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={id}
            className="ig-tabs__tab headline-small"
            aria-selected={selected}
            aria-controls={tab.id ? `${tab.id}-panel` : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => select(i)}
          >
            {tab.label}
            {tab.count !== undefined && <span className="ig-tabs__count label-small tnum">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

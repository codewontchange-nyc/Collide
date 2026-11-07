import type { ReactNode } from "react";

/** The pressable chip that stays pressed. momentary: a one shot action in chip clothes (a suggestion that fills a field): no aria-pressed, never stays pressed. */
export function FilterChip({
  pressed = false,
  onPress,
  count,
  disabled = false,
  momentary = false,
  children,
  className,
}: {
  pressed?: boolean;
  onPress: () => void;
  count?: number;
  disabled?: boolean;
  momentary?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const cls = ["ig-chip", "label-small", className].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} aria-pressed={momentary ? undefined : pressed} disabled={disabled} onClick={onPress}>
      {children}
      {count !== undefined && <span className="ig-chip__count tnum">{count}</span>}
    </button>
  );
}

/** A wrapping (default) or scrolling row of chips, 44px tall rows. A row that must show every option (weekdays, urgency, skills in a form) wraps;
 *  only a long optional set scrolls. label names the row as a group. */
export function ChipRow({ scroll = false, label, children, className }: { scroll?: boolean; label?: string; children: ReactNode; className?: string }) {
  const cls = ["ig-chiprow", scroll ? "ig-chiprow--scroll ig-scroll-x" : "", className].filter(Boolean).join(" ");
  const a11y = label ? { role: "group", "aria-label": label } : {};
  return (
    <div className={cls} {...a11y}>
      {children}
    </div>
  );
}

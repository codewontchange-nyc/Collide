import { NavLink, useLocation } from "react-router";
import { AmbientIcon, type PatternName } from "@/system/DotGrid/DotGrid";

export interface TabBarItem {
  to: string;
  label: string;
  mark: PatternName;
  end?: boolean;
  /** a count beside the word in label-small neutral-06 ("Needs 2"); omitted or 0 shows nothing */
  count?: number;
}

/** Binding: Home full, Budget rise, Needs plus, Colony colony, You center. */
export const MEMBER_TABS: TabBarItem[] = [
  { to: "/", label: "Home", mark: "full", end: true },
  { to: "/budget", label: "Budget", mark: "rise" },
  { to: "/needs", label: "Needs", mark: "plus" },
  { to: "/colony", label: "Colony", mark: "colony" },
  { to: "/you", label: "You", mark: "center" },
];

/** Binding: Today full, Earnings rise, Availability plus (no Needs on the provider bar, so plus reads as room in the day). */
export const PROVIDER_TABS: TabBarItem[] = [
  { to: "/provider", label: "Today", mark: "full", end: true },
  { to: "/provider/earnings", label: "Earnings", mark: "rise" },
  { to: "/provider/availability", label: "Availability", mark: "plus" },
];

/** Where the reader was in a tab, written on leave and read by Screen on mount. */
function rememberScroll(pathname: string) {
  const main = document.querySelector<HTMLElement>(".ig-main");
  if (!main) return;
  try {
    sessionStorage.setItem(`colony.scroll.${pathname}`, String(Math.round(main.scrollTop)));
  } catch {
    /* storage can be unavailable; the tab still navigates */
  }
}

/** The bottom tab bar: a 20px dot mark over the word, the 3px dot straddling the hairline on the current tab.
 *  The current mark settles dot by dot in reading order. inline (library only) renders it in flow instead of fixed. */
export function TabBar({ tabs, label = "Primary", inline = false, className }: { tabs: TabBarItem[]; label?: string; inline?: boolean; className?: string }) {
  const { pathname } = useLocation();
  const cls = ["ig-tabbar", inline ? "ig-tabbar--inline" : "", className].filter(Boolean).join(" ");
  return (
    <nav className={cls} aria-label={label}>
      <ul className="ig-tabbar__list">
        {tabs.map((t) => (
          <li className="ig-tabbar__item" key={t.to}>
            <NavLink to={t.to} end={t.end} className="ig-tabbar__link" onClick={() => rememberScroll(pathname)}>
              {({ isActive }) => (
                <>
                  <AmbientIcon key={isActive ? "current" : "rest"} className="ig-tabbar__mark" pattern={t.mark} unlit="surface" settle={isActive} settleOrder="reading" />
                  <span className="ig-tabbar__word paragraph-x-small">
                    {t.label}
                    {t.count !== undefined && t.count > 0 && <span className="ig-tabbar__count label-small"> {t.count}</span>}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

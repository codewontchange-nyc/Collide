import { NavLink, useLocation } from "react-router";
import { motion } from "motion/react";
import { Icon, type IconName } from "@/ui/Icon";

export interface Tab { to: string; label: string; icon: IconName; end?: boolean }

export const MEMBER_TABS: Tab[] = [
  { to: "/", label: "Home", icon: "home", end: true },
  { to: "/budget", label: "Budget", icon: "budget" },
  { to: "/needs", label: "Needs", icon: "needs" },
  { to: "/colony", label: "Colony", icon: "colony" },
  { to: "/you", label: "You", icon: "you" },
];

export const PROVIDER_TABS: Tab[] = [
  { to: "/provider", label: "Today", icon: "today", end: true },
  { to: "/provider/earnings", label: "Earnings", icon: "earnings" },
  { to: "/provider/availability", label: "Availability", icon: "availability" },
];

/** Bottom tabs. The active tab carries a hex cell that slides between tabs. */
export function Tabs({ tabs, id }: { tabs: Tab[]; id: string }) {
  const { pathname } = useLocation();
  return (
    <nav className="tabs" aria-label="Primary">
      <div className="tabs-inner">
        {tabs.map((t) => {
          const on = t.end ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <NavLink key={t.to} to={t.to} end={t.end} className={["navtab", on ? "on" : ""].join(" ")} aria-current={on ? "page" : undefined}>
              {on && (
                <motion.svg layoutId={`${id}-cell`} className="cell" viewBox="0 0 26 26" fill="none" transition={{ type: "spring", stiffness: 380, damping: 30 }} aria-hidden>
                  <path d="M13 1.5l9.5 5.5v11L13 23.5 3.5 18V7z" fill="var(--honey-soft)" stroke="var(--honey)" strokeWidth={1} />
                </motion.svg>
              )}
              <Icon name={t.icon} />
              <span>{t.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

import type { HTMLAttributes } from "react";

/** A hairline (default) or ink rule with no margin: margins come from the grid gaps, never from the divider. */
export function Divider({ rule = "hairline", className, ...rest }: { rule?: "hairline" | "ink"; className?: string } & HTMLAttributes<HTMLHRElement>) {
  const cls = ["ig-divider", rule === "ink" ? "ig-divider--ink" : "", className].filter(Boolean).join(" ");
  return <hr className={cls} {...rest} />;
}

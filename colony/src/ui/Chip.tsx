import type { ReactNode } from "react";

export function Chip({
  tone = "paper",
  on,
  onClick,
  children,
}: {
  tone?: "paper" | "honey" | "ink" | "ok" | "line" | "danger";
  on?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  const cls = ["chip", tone !== "paper" ? tone : "", onClick ? "btn-chip" : "", on ? "on" : ""].filter(Boolean).join(" ");
  if (onClick)
    return (
      <button type="button" className={cls} onClick={onClick} aria-pressed={on}>
        {children}
      </button>
    );
  return <span className={cls}>{children}</span>;
}

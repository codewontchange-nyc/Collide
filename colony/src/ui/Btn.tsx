import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "ink" | "honey" | "ghost" | "text";
  size?: "md" | "sm";
  block?: boolean;
  danger?: boolean;
  children: ReactNode;
};

export function Btn({ variant = "ink", size = "md", block, danger, className = "", children, ...rest }: Props) {
  const cls = ["btn", variant !== "ink" ? variant : "", size === "sm" ? "sm" : "", block ? "block" : "", danger ? "danger" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

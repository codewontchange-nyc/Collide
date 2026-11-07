import type { HTMLAttributes, ReactNode } from "react";

/** The mono eyebrow. secondary (default) above a title, meta in a trail or a meta line, ink when it is the control label.
 *  No dot before it, no negative margin, no honey. */
export function Kicker({
  tone = "secondary",
  as: Tag = "p",
  children,
  className,
  ...rest
}: {
  tone?: "secondary" | "meta" | "ink";
  as?: "p" | "span" | "div";
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLElement>) {
  const cls = ["ig-kicker", `ig-kicker--${tone}`, "label-small", className].filter(Boolean).join(" ");
  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  );
}

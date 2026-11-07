import type { ReactNode } from "react";

/** The kit's quote shape: prose read once, beside a 1px rule. The serif is never grey and never italic. */
export function Quote({
  size = "medium",
  tone,
  cite,
  children,
  className,
}: {
  /** medium: paragraph-medium Cardo 18 (default); large: paragraph-large 22 */
  size?: "medium" | "large";
  tone?: "ink";
  cite?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const cls = ["ig-quote", `ig-quote--${size}`, tone ? `ig-quote--${tone}` : "", className].filter(Boolean).join(" ");
  return (
    <blockquote className={cls}>
      <p className={["ig-quote__text", size === "large" ? "paragraph-large" : "paragraph-medium"].join(" ")}>{children}</p>
      {cite !== undefined && cite !== null && cite !== false && <footer className="ig-quote__cite label-small">{cite}</footer>}
    </blockquote>
  );
}

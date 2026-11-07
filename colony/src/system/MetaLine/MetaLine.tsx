import { Fragment, type HTMLAttributes, type ReactNode } from "react";

/** Facts joined by middots: "NOV 5 · 9:00 AM · 4 OF 28". Each fact is an inline block that carries its own trailing separator,
 *  so a narrow column breaks between facts, never inside one and never before a dot: a line ends with the dot, the next starts with a fact.
 *  Empty facts (null, undefined, false, "") are skipped so a caller can include one conditionally. */
export function MetaLine({
  facts,
  tone = "meta",
  as: Tag = "p",
  className,
  ...rest
}: {
  facts: ReactNode[];
  tone?: "secondary" | "meta" | "ink";
  as?: "p" | "span";
  className?: string;
} & HTMLAttributes<HTMLElement>) {
  const cls = ["ig-meta", `ig-meta--${tone}`, "label-small", className].filter(Boolean).join(" ");
  const shown = facts.filter((f) => f !== null && f !== undefined && f !== false && f !== "");
  return (
    <Tag className={cls} {...rest}>
      {shown.map((fact, i) => (
        <Fragment key={i}>
          <span className="ig-meta__fact">
            {fact}
            {i < shown.length - 1 && <span className="ig-meta__sep"> · </span>}
          </span>
        </Fragment>
      ))}
    </Tag>
  );
}

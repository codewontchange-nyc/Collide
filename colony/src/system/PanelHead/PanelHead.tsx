import type { HTMLAttributes, ReactNode } from "react";

/** The page column for places that are not a Screen (sheet bodies do not use it). */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={["ig-page", className].filter(Boolean).join(" ")}>{children}</div>;
}

/** A module: a grid with 16px gaps. Pass aria-labelledby with the PanelHead's id, or label for a name of its own. */
export function Panel({
  as: Tag = "section",
  label,
  children,
  className,
  ...rest
}: { as?: "section" | "div"; label?: string; children: ReactNode; className?: string } & HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={["ig-panel", className].filter(Boolean).join(" ")} aria-label={label} {...rest}>
      {children}
    </Tag>
  );
}

/** A panel's head: an optional 2ch index, the title in sentence case, meta or an action at the right, a rule under, a description. */
export function PanelHead({
  index,
  title,
  meta,
  rule = "hairline",
  description,
  action,
  headingLevel = 2,
  id,
  className,
}: {
  index?: string;
  title: ReactNode;
  /** label-small neutral-06, right aligned ("4 OF 28 THIS MONTH") */
  meta?: ReactNode;
  /** ink above a ranked or money list */
  rule?: "hairline" | "ink";
  description?: ReactNode;
  /** a QuietButton at the right, after meta when both are given */
  action?: ReactNode;
  headingLevel?: 2 | 3;
  id?: string;
  className?: string;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const hasIndex = index !== undefined && index !== "";
  const hasMeta = meta !== undefined && meta !== null && meta !== false;
  const hasAction = action !== undefined && action !== null && action !== false;
  const cls = ["ig-panel__head", `ig-panel__head--${rule}`, hasIndex ? "ig-panel__head--indexed" : "", className].filter(Boolean).join(" ");
  const head = (
    <div className={cls}>
      {hasIndex && <span className="ig-panel__index label-small">{index}</span>}
      <Heading className="ig-panel__title headline-small" id={id}>
        {title}
      </Heading>
      {(hasMeta || hasAction) && (
        <span className="ig-panel__end">
          {hasMeta && <span className="ig-panel__meta label-small">{meta}</span>}
          {hasAction && <span className="ig-panel__action">{action}</span>}
        </span>
      )}
    </div>
  );
  if (description === undefined || description === null || description === false) return head;
  return (
    <div className="ig-panel__intro">
      {head}
      <p className="ig-panel__description paragraph-x-small">{description}</p>
    </div>
  );
}

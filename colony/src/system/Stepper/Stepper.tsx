import { Link } from "react-router";

type Step = { label: string; hint?: string; href?: string };

type StepperProps = {
  steps: Step[];
  /** zero based index of the current step */
  current: number;
  /** names the nav */
  label: string;
  /** the column is the only layout; the prop exists so a row form can be added without renaming */
  layout?: "column";
  className?: string;
};

function status(i: number, current: number): "done" | "current" | "todo" {
  if (i < current) return "done";
  if (i === current) return "current";
  return "todo";
}

/** A step sequence: a hairline rail with a 9px mark per step, the index in mono digits, the label, an optional hint.
 *  Done steps with an href are links. Library and timelines only; the Start wizard uses Steps. */
export function Stepper({ steps, current, label, layout = "column", className }: StepperProps) {
  const cls = ["ig-stepper", `ig-stepper--${layout}`, className].filter(Boolean).join(" ");
  return (
    <nav className={cls} aria-label={label}>
      <ol className="ig-stepper__list">
        {steps.map((step, i) => {
          const s = status(i, current);
          const href = s === "done" ? step.href : undefined;
          const linked = href !== undefined;
          const text =
            href === undefined ? (
              step.label
            ) : href.startsWith("/") ? (
              <Link to={href} className="ig-stepper__link">
                {step.label}
              </Link>
            ) : (
              <a href={href} className="ig-stepper__link">
                {step.label}
              </a>
            );
          return (
            <li key={i} className="ig-stepper__step" data-status={s} data-href={linked ? "" : undefined} aria-current={s === "current" ? "step" : undefined}>
              <span className="ig-stepper__mark" aria-hidden="true" />
              <span className="ig-stepper__index label-small">{i + 1}</span>
              <span className="ig-stepper__label headline-small">{text}</span>
              {step.hint && <span className="ig-stepper__hint paragraph-x-small">{step.hint}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

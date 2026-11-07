import type { ReactNode } from "react";
import { Link } from "react-router";
import { SignalDot, type DotState } from "@/system/SignalDot/SignalDot";

type TagProps = {
  /** muted (default): neutral-01 ground; ink: inverted; outlined: surface with the hairline */
  tone?: "muted" | "ink" | "outlined";
  /** adds a SignalDot before the label */
  state?: DotState;
  href?: string;
  onRemove?: () => void;
  removeLabel?: string;
  children: ReactNode;
  className?: string;
};

/** The 10 by 10 cross for the remove button: stroke 1.4, round caps, redrawn in the glyph grammar. */
function Cross() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
      <path d="M2 2L8 8M8 2L2 8" />
    </svg>
  );
}

/** A label, never a control (the control is FilterChip). 24px, label-small, with an optional dot, link or remove button.
 *  A tag is not a touch target unless it has href or onRemove; then the row that holds it is 44px, or the halo applies. */
export function Tag({ tone = "muted", state, href, onRemove, removeLabel = "Remove", children, className }: TagProps) {
  const cls = ["ig-tag", `ig-tag--${tone}`, "label-small", className].filter(Boolean).join(" ");
  const dot = state ? <SignalDot state={state} className="ig-tag__dot" /> : null;
  const remove = onRemove ? (
    <button type="button" className="ig-tag__remove" aria-label={removeLabel} onClick={onRemove}>
      <Cross />
    </button>
  ) : null;

  if (href !== undefined && !onRemove) {
    const inner = (
      <>
        {dot}
        {children}
      </>
    );
    return href.startsWith("/") ? (
      <Link to={href} className={cls}>
        {inner}
      </Link>
    ) : (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  }

  if (href !== undefined) {
    /* a link and a remove button cannot nest, so the label is the link and the button sits beside it */
    const link = href.startsWith("/") ? (
      <Link to={href} className="ig-tag__link">
        {children}
      </Link>
    ) : (
      <a href={href} className="ig-tag__link">
        {children}
      </a>
    );
    return (
      <span className={cls}>
        {dot}
        {link}
        {remove}
      </span>
    );
  }

  return (
    <span className={cls}>
      {dot}
      {children}
      {remove}
    </span>
  );
}

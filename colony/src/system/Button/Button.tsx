import { useEffect, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router";
import { DotArrow, Glyph, type GlyphName } from "@/system/Glyph/Glyph";

export type ButtonVariant = "dark" | "grey" | "light" | "outlined" | "glassy" | "danger";

type ButtonProps = {
  /** default "dark": the one primary on a screen or sheet */
  variant?: ButtonVariant;
  /** drops the trailing DotArrow. On a phone every button in a row passes it */
  hideIcon?: boolean;
  /** a leading Glyph in the 20px box, gap 8; replaces the arrow */
  icon?: GlyphName;
  /** 52px square; children is the accessible name; icon required */
  iconOnly?: boolean;
  /** fixed bottom right above the tab bar; with iconOnly the square, else a labelled pill */
  fab?: boolean;
  /** width 100%, centered label */
  block?: boolean;
  href?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  /** the label, sentence case */
  children: ReactNode;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement> & AnchorHTMLAttributes<HTMLAnchorElement>, "type">;

/* --fab-clearance (52 + 16) on <html> while any FAB is mounted; .ig-page and the ToastHost read it with a 0px fallback. */
let fabs = 0;
function useFabClearance(on: boolean) {
  useEffect(() => {
    if (!on) return;
    fabs += 1;
    document.documentElement.style.setProperty("--fab-clearance", "calc(var(--size-control) + var(--padding-med))");
    return () => {
      fabs -= 1;
      if (fabs === 0) document.documentElement.style.removeProperty("--fab-clearance");
    };
  }, [on]);
}

/** The kit's Button: 52px, the one pill, label in headline-small, the dot arrow trailing unless hidden. No press scale; the background changes. */
export function Button({
  variant = "dark",
  hideIcon = false,
  icon,
  iconOnly = false,
  fab = false,
  block = false,
  href,
  disabled = false,
  type = "button",
  children,
  className,
  ...rest
}: ButtonProps) {
  useFabClearance(fab);
  const cls = [
    "ig-button",
    `ig-button--${variant}`,
    block ? "ig-button--block" : "",
    iconOnly ? "ig-button--icon-only" : "",
    fab ? "ig-button--fab" : "",
    icon && !iconOnly ? "ig-button--leading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const showArrow = !hideIcon && !icon && !iconOnly;
  const name = iconOnly && typeof children === "string" ? children : undefined;
  const inner = iconOnly ? (
    <>
      {icon && (
        <span className="ig-button__icon">
          <Glyph name={icon} />
        </span>
      )}
      {!name && <span className="ig-sr">{children}</span>}
    </>
  ) : (
    <>
      {icon && (
        <span className="ig-button__icon">
          <Glyph name={icon} />
        </span>
      )}
      <span className="ig-button__label headline-small">{children}</span>
      {showArrow && (
        <span className="ig-button__icon">
          <DotArrow />
        </span>
      )}
    </>
  );
  const ariaLabel = name ?? rest["aria-label"];

  if (href !== undefined) {
    const { onClick, ...anchorRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    if (disabled) {
      /* a disabled link: no href and no handler, so it neither navigates nor focuses */
      return (
        <a className={cls} role="link" aria-disabled="true" tabIndex={-1} {...anchorRest} aria-label={ariaLabel}>
          {inner}
        </a>
      );
    }
    if (href.startsWith("/")) {
      return (
        <Link to={href} className={cls} onClick={onClick} {...anchorRest} aria-label={ariaLabel}>
          {inner}
        </Link>
      );
    }
    return (
      <a href={href} className={cls} onClick={onClick} {...anchorRest} aria-label={ariaLabel}>
        {inner}
      </a>
    );
  }

  const buttonRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type={type} className={cls} disabled={disabled} {...buttonRest} aria-label={ariaLabel}>
      {inner}
    </button>
  );
}

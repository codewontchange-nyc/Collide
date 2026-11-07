import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { Link } from "react-router";
import { Glyph, type GlyphName } from "@/system/Glyph/Glyph";

type IconButtonProps = {
  icon: GlyphName;
  /** the accessible name; the glyph is decorative */
  label: string;
  href?: string;
  disabled?: boolean;
  /** secondary (default): neutral-08, ink on hover; ink: neutral-10 at rest */
  tone?: "secondary" | "ink";
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

/** A 44px square holding one glyph: Back (chevron-left), Close (close), the sheet close, Advance a month (clock).
 *  Like Button it does not scale on press; it washes neutral-01. */
export function IconButton({ icon, label, href, disabled = false, tone = "secondary", className, type = "button", ...rest }: IconButtonProps) {
  const cls = ["ig-iconbtn", tone === "ink" ? "ig-iconbtn--ink" : "", className].filter(Boolean).join(" ");
  const inner = <Glyph name={icon} />;

  if (href !== undefined) {
    const { onClick, ...anchorRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    if (disabled) {
      /* a disabled link: no href and no handler, so it neither navigates nor focuses */
      return (
        <a className={cls} role="link" aria-disabled="true" tabIndex={-1} aria-label={label} {...anchorRest}>
          {inner}
        </a>
      );
    }
    if (href.startsWith("/")) {
      return (
        <Link to={href} className={cls} aria-label={label} onClick={onClick} {...anchorRest}>
          {inner}
        </Link>
      );
    }
    return (
      <a href={href} className={cls} aria-label={label} onClick={onClick} {...anchorRest}>
        {inner}
      </a>
    );
  }

  return (
    <button type={type} className={cls} aria-label={label} disabled={disabled} {...rest}>
      {inner}
    </button>
  );
}

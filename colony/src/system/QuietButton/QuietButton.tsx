import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router";
import { Glyph, type GlyphName } from "@/system/Glyph/Glyph";

type QuietButtonProps = {
  href?: string;
  disabled?: boolean;
  /** secondary (default): neutral-08 with a neutral-02 rule; ink: neutral-10 with an ink rule */
  tone?: "secondary" | "ink";
  /** a leading 20px Glyph, gap 4 */
  icon?: GlyphName;
  /** the label; label-small sets it in uppercase mono */
  children: ReactNode;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

/** The kit's underlined mono idiom: clear, load more, read the whole thing, remove, add a person.
 *  Never carries the DotArrow (that belongs to Button alone). A 44px hit by the halo recipe. */
export function QuietButton({ href, disabled = false, tone = "secondary", icon, children, className, type = "button", ...rest }: QuietButtonProps) {
  const cls = ["ig-quiet", "label-small", tone === "ink" ? "ig-quiet--ink" : "", className].filter(Boolean).join(" ");
  const inner = (
    <>
      {icon && <Glyph name={icon} />}
      {children}
    </>
  );

  if (href !== undefined) {
    const { onClick, ...anchorRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    if (disabled) {
      /* a disabled link: no href and no handler, so it neither navigates nor focuses */
      return (
        <a className={cls} role="link" aria-disabled="true" tabIndex={-1} {...anchorRest}>
          {inner}
        </a>
      );
    }
    if (href.startsWith("/")) {
      return (
        <Link to={href} className={cls} onClick={onClick} {...anchorRest}>
          {inner}
        </Link>
      );
    }
    return (
      <a href={href} className={cls} onClick={onClick} {...anchorRest}>
        {inner}
      </a>
    );
  }

  return (
    <button type={type} className={cls} disabled={disabled} {...rest}>
      {inner}
    </button>
  );
}

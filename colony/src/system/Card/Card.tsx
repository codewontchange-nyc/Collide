import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { Link } from "react-router";

export type CardGround = "edge" | "ground" | "inverted";

type CardProps = {
  /** edge: surface with the hairline (default); ground: neutral-01, no border; inverted: ink with surface text, once per screen */
  ground?: CardGround;
  /** data-selected: border ink (edge), inset ring (ground) */
  selected?: boolean;
  /** pressable: renders a button (onPress) or a link (href), full width, text left */
  onPress?: () => void;
  href?: string;
  /** aria-pressed for a pickable card (the match sheet) */
  pressed?: boolean;
  as?: "div" | "section" | "article" | "li";
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLElement>;

/** The one card: three grounds and no more. No shadow, no hover lift, at most one inverted card per screen. */
export function Card({ ground = "edge", selected, onPress, href, pressed, as: Tag = "div", children, className, ...rest }: CardProps) {
  const pressable = onPress !== undefined || href !== undefined;
  const cls = ["ig-card", ground !== "edge" ? `ig-card--${ground}` : "", pressable ? "ig-card--pressable" : "", className].filter(Boolean).join(" ");
  const data = selected ? { "data-selected": "true" } : {};

  if (!pressable) {
    return (
      <Tag className={cls} {...data} {...rest}>
        {children}
      </Tag>
    );
  }

  let inner: ReactNode;
  if (href !== undefined) {
    const anchorRest = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    inner = href.startsWith("/") ? (
      <Link to={href} className={cls} {...data} {...anchorRest} onClick={onPress}>
        {children}
      </Link>
    ) : (
      <a href={href} className={cls} {...data} {...anchorRest} onClick={onPress}>
        {children}
      </a>
    );
  } else {
    const buttonRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;
    inner = (
      <button type="button" className={cls} aria-pressed={pressed === undefined ? undefined : pressed} {...data} {...buttonRest} onClick={onPress}>
        {children}
      </button>
    );
  }
  /* a pressable card in a list keeps its li */
  return Tag === "li" ? <li className="ig-card__item">{inner}</li> : inner;
}

/** The card's first row: title at the left, a word or a figure at the right. */
export function CardTop({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={["ig-card__top", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function CardTitle({ children, as: Tag = "h3", className }: { children: ReactNode; as?: "h2" | "h3" | "p"; className?: string }) {
  return <Tag className={["ig-card__title", "headline-small", className].filter(Boolean).join(" ")}>{children}</Tag>;
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={["ig-card__body", "paragraph-x-small", className].filter(Boolean).join(" ")}>{children}</div>;
}

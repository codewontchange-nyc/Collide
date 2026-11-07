import type { ReactNode } from "react";
import { Link } from "react-router";
import { Glyph } from "@/system/Glyph/Glyph";
import { SignalDot } from "@/system/SignalDot/SignalDot";

export type NoticeKind = "default" | "success" | "error";
export type NoticePlacement = "inline" | "banner" | "toast";

type NoticeProps = {
  /** sets the dot: default grey, success green, error red */
  kind?: NoticeKind;
  /** inline: the neutral-01 box; banner: edge to edge with a hairline under; toast: ink on surface text with the one shadow */
  placement?: NoticePlacement;
  title?: string;
  children?: ReactNode;
  /** the underlined mono action; href renders a link */
  action?: { label: string; href?: string; onClick?: () => void };
  /** shows the close glyph in a 44px hit box */
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
};

/** A dot, a title and a body, an action and a close. role alert for errors, status otherwise. */
export function Notice({ kind = "default", placement = "inline", title, children, action, onDismiss, dismissLabel = "Close", className }: NoticeProps) {
  const cls = ["ig-notice", `ig-notice--${placement}`, `ig-notice--${kind}`, className].filter(Boolean).join(" ");
  const error = kind === "error";
  const toast = placement === "toast";
  const actionInner = <span className="ig-notice__action-label label-small">{action?.label}</span>;
  return (
    <div className={cls} role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"}>
      <SignalDot state={kind} pulse={toast ? true : undefined} className="ig-notice__dot" />
      <div className="ig-notice__text">
        {title && <p className="ig-notice__title headline-small">{title}</p>}
        {children !== undefined && children !== null && <p className="ig-notice__body paragraph-x-small">{children}</p>}
      </div>
      {action &&
        (action.href !== undefined ? (
          action.href.startsWith("/") ? (
            <Link to={action.href} className="ig-notice__action" onClick={action.onClick}>
              {actionInner}
            </Link>
          ) : (
            <a href={action.href} className="ig-notice__action" onClick={action.onClick}>
              {actionInner}
            </a>
          )
        ) : (
          <button type="button" className="ig-notice__action" onClick={action.onClick}>
            {actionInner}
          </button>
        ))}
      {onDismiss && (
        <button type="button" className="ig-notice__close" aria-label={dismissLabel} onClick={onDismiss}>
          <Glyph name="close" />
        </button>
      )}
    </div>
  );
}

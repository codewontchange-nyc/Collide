import type { CSSProperties, ReactNode } from "react";
import { SignalDot } from "@/system/SignalDot/SignalDot";

type LoadingProps = {
  /** bar: the 4px sweep; sentence: a mono line with the default dot pulsing before it */
  kind?: "bar" | "sentence";
  /** the bar sweeps a single time over duration ms and ends full, so it can end with a swap */
  once?: boolean;
  /** ms, for once; default 1200 */
  duration?: number;
  /** the sentence */
  children?: ReactNode;
  /** the bar's accessible name; default "Loading" */
  label?: string;
  className?: string;
};

/** The kit's 4px loading bar, or a mono sentence with a breathing dot. Skeletons are not a component. */
export function Loading({ kind = "bar", once = false, duration = 1200, children, label = "Loading", className }: LoadingProps) {
  if (kind === "sentence") {
    const cls = ["ig-loading", "ig-loading--sentence", "label-small", className].filter(Boolean).join(" ");
    return (
      <p className={cls} role="status">
        <SignalDot state="default" pulse className="ig-loading__dot" />
        <span className="ig-loading__word">{children}</span>
      </p>
    );
  }
  const cls = ["ig-loading", "ig-loading--bar", once ? "ig-loading--once" : "", className].filter(Boolean).join(" ");
  const style = once ? ({ "--ig-loading-duration": `${duration}ms` } as CSSProperties) : undefined;
  return (
    <div className={cls} role="progressbar" aria-label={label} aria-busy="true" style={style}>
      <span className="ig-loading__sweep" />
    </div>
  );
}

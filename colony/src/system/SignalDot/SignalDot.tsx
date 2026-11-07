import type { ReactNode } from "react";

export type DotState = "default" | "error" | "success" | "inactive";

/** The default pulse rule: a yes and a failure breathe; attention and a no do not unless asked. */
function pulses(state: DotState, pulse: boolean | undefined): boolean {
  return pulse ?? (state === "success" || state === "error");
}

/** A 20px dot that says a state. Decorative unless given a label; in Colony it always sits beside its word. */
export function SignalDot({ state = "default", pulse, label, className }: { state?: DotState; pulse?: boolean; label?: string; className?: string }) {
  const cls = ["ig-dot", "ig-dot--signal", className].filter(Boolean).join(" ");
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  const inactive = state === "inactive";
  return (
    <svg className={cls} data-state={state} data-pulse={pulses(state, pulse) ? "true" : "false"} width="20" height="20" viewBox="0 0 20 20" {...a11y}>
      {/* inactive keeps its outer edge at 7 with a hairline ring, so it reads on a neutral-01 ground */}
      <circle cx="10" cy="10" r={inactive ? 6.5 : 7} />
    </svg>
  );
}

/** A dot and its word, the only way Colony says status. */
export function StatusWord({
  state = "default",
  children,
  pulse,
  tone = "secondary",
  className,
}: {
  state?: DotState;
  children: ReactNode;
  pulse?: boolean;
  tone?: "ink" | "secondary";
  className?: string;
}) {
  const cls = ["ig-status", tone === "ink" ? "ig-status--ink" : "", className].filter(Boolean).join(" ");
  return (
    <span className={cls}>
      <SignalDot state={state} pulse={pulse} />
      <span className="ig-status__word label-small">{children}</span>
    </span>
  );
}

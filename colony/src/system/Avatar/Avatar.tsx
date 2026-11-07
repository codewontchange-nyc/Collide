import { useState, type CSSProperties, type HTMLAttributes } from "react";
import type { DotState } from "@/system/SignalDot/SignalDot";

export type AvatarSize = "sm" | "md" | "lg";

/** The first letters of the first two words. Moved from src/ui/Avatar.tsx, unchanged. */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const INITIALS_TYPE: Record<AvatarSize, string> = { sm: "", md: "label-small", lg: "headline-medium" };

/** The only round thing. sm 20 (in a stack or beside meta), md 44 (a row), lg 84 (a sheet head, the You page).
 *  A broken or missing image falls back to the initials; the name is always the accessible name. */
export function Avatar({
  name,
  src,
  size = "md",
  state,
  className,
  ...rest
}: { name: string; src?: string; size?: AvatarSize; state?: DotState; className?: string } & HTMLAttributes<HTMLSpanElement>) {
  const [broken, setBroken] = useState(false);
  const cls = ["ig-avatar", `ig-avatar--${size}`, className].filter(Boolean).join(" ");
  const showImage = Boolean(src) && !broken;
  return (
    <span className={cls} role="img" aria-label={name} {...rest}>
      {showImage ? (
        <img className="ig-avatar__img" src={src} alt="" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <span className={["ig-avatar__initials", INITIALS_TYPE[size]].filter(Boolean).join(" ")} aria-hidden="true">
          {initials(name)}
        </span>
      )}
      {state && <span className="ig-avatar__state" data-state={state} />}
    </span>
  );
}

/** Overlapping avatars with a "+N" rest. max default 4, size default sm. Earlier avatars draw over later ones (z-index counts down). */
export function AvatarStack({
  people,
  max = 4,
  size = "sm",
  className,
}: {
  people: { name: string; avatar?: string }[];
  max?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const shown = people.slice(0, Math.max(0, max));
  const rest = people.length - shown.length;
  const cls = ["ig-avatar-stack", className].filter(Boolean).join(" ");
  return (
    <span className={cls}>
      {shown.map((p, i) => (
        <Avatar key={p.name} name={p.name} src={p.avatar} size={size} style={{ "--ig-stack-z": shown.length - i } as CSSProperties} />
      ))}
      {rest > 0 && (
        <span className={["ig-avatar", `ig-avatar--${size}`, "ig-avatar--rest"].join(" ")} role="img" aria-label={`and ${rest} more`}>
          <span className={["ig-avatar__initials", INITIALS_TYPE[size]].filter(Boolean).join(" ")} aria-hidden="true">
            +{rest}
          </span>
        </span>
      )}
    </span>
  );
}

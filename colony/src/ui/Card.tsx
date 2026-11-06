import type { HTMLAttributes, ReactNode } from "react";

export function Card({
  flat,
  line,
  press,
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { flat?: boolean; line?: boolean; press?: boolean; children: ReactNode }) {
  const cls = ["card", flat ? "flat" : "", line ? "line" : "", press ? "press" : "", className].filter(Boolean).join(" ");
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}

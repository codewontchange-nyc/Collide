import { fmt } from "@/domain/money";
import { useCountUp } from "@/motion";

export function Money({ cents, lg, animate = true, className = "" }: { cents: number; lg?: boolean; animate?: boolean; className?: string }) {
  const shown = useCountUp(animate ? cents : cents, 0.9);
  const cls = ["money", lg ? "lg" : "", className].filter(Boolean).join(" ");
  return <span className={cls}>{fmt(animate ? shown : cents)}</span>;
}

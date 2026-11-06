import type { ReactNode } from "react";
import { Companion } from "@/brand/Companion";

export function Kicker({ children, honey, className = "" }: { children: ReactNode; honey?: boolean; className?: string }) {
  return <div className={["kicker", honey ? "honey" : "", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function PageHead({ kicker, title, sub, right, companion = true }: { kicker?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; companion?: boolean }) {
  return (
    <header className="page-head">
      <div className="grow">
        {kicker && <Kicker>{kicker}</Kicker>}
        <h1>{title}</h1>
        {sub && <p className="sub" style={{ marginTop: 8 }}>{sub}</p>}
      </div>
      {right ?? (companion ? <Companion /> : null)}
    </header>
  );
}

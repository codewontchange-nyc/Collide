import type { ReactNode } from "react";
import { motion } from "motion/react";
import { fadeRise, screenEnter } from "@/motion";

/** A screen enters with a soft rise and staggers its direct children. */
export function Screen({ children, bare, className = "" }: { children: ReactNode; bare?: boolean; className?: string }) {
  return (
    <motion.main className={["screen", bare ? "bare" : "", className].filter(Boolean).join(" ")} variants={screenEnter} initial="hidden" animate="show">
      {children}
    </motion.main>
  );
}

export function Rise({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div className={className} variants={fadeRise} style={style}>
      {children}
    </motion.div>
  );
}

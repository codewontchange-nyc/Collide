import { motion } from "motion/react";

export function Stamp({ children = "Handled.", animate = true }: { children?: string; animate?: boolean }) {
  return (
    <motion.span
      className="stamp"
      initial={animate ? { scale: 1.3, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5 10 17l9-10" />
      </svg>
      {children}
    </motion.span>
  );
}

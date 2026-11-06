import { motion, useReducedMotion } from "motion/react";

// Six thin cells on a hex lattice around one honey cell. The colony around you.
const RING = [
  [32, 12],
  [49.3, 22],
  [49.3, 42],
  [32, 52],
  [14.7, 42],
  [14.7, 22],
] as const;

export function Mark({ size = 40, drawIn = false, className }: { size?: number; drawIn?: boolean; className?: string }) {
  const reduced = useReducedMotion();
  const animate = drawIn && !reduced;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      {RING.map(([cx, cy], i) => (
        <motion.circle
          key={i}
          cx={cx}
          cy={cy}
          r={5}
          stroke="currentColor"
          strokeWidth={1.5}
          initial={animate ? { pathLength: 0, opacity: 0 } : false}
          animate={animate ? { pathLength: 1, opacity: 1 } : undefined}
          transition={{ duration: 0.5, delay: 0.08 * i, ease: "easeInOut" }}
        />
      ))}
      <motion.circle
        cx={32}
        cy={32}
        r={5}
        fill="var(--honey)"
        initial={animate ? { scale: 0, opacity: 0 } : false}
        animate={animate ? { scale: 1, opacity: 1 } : undefined}
        transition={{ delay: 0.55, type: "spring", stiffness: 300, damping: 18 }}
        style={{ transformOrigin: "32px 32px" }}
      />
    </svg>
  );
}

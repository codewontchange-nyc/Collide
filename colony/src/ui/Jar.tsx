import { motion, useReducedMotion } from "motion/react";

/** A honey jar that fills toward `max`. The pool, drawn. */
export function Jar({ cents, maxCents }: { cents: number; maxCents: number }) {
  const reduced = useReducedMotion();
  const frac = Math.max(0.04, Math.min(1, maxCents > 0 ? cents / maxCents : 0));
  const top = 26;
  const bottom = 142;
  const h = (bottom - top) * frac;
  return (
    <div className="jar" aria-hidden>
      <svg viewBox="0 0 120 150" fill="none">
        <defs>
          <clipPath id="jar-clip">
            <path d="M22 26h76v100a16 16 0 0 1-16 16H38a16 16 0 0 1-16-16z" />
          </clipPath>
        </defs>
        <g clipPath="url(#jar-clip)">
          <motion.rect
            x={22}
            width={76}
            fill="var(--honey)"
            initial={false}
            animate={{ y: bottom - h, height: h + 4 }}
            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 90, damping: 18 }}
          />
          <motion.path
            d="M22 0c10 0 10 6 20 6s10-6 20-6 10 6 20 6 10-6 20-6v10H22z"
            fill="var(--honey)"
            opacity={0.55}
            initial={false}
            animate={{ y: bottom - h - 6, x: [0, -8, 0] }}
            transition={reduced ? { duration: 0 } : { y: { type: "spring", stiffness: 90, damping: 18 }, x: { duration: 3, repeat: Infinity, ease: "easeInOut" } }}
          />
        </g>
        <path d="M22 26h76v100a16 16 0 0 1-16 16H38a16 16 0 0 1-16-16z" stroke="var(--ink)" strokeWidth={1.5} />
        <path d="M30 12h60a6 6 0 0 1 6 6v8H24v-8a6 6 0 0 1 6-6z" stroke="var(--ink)" strokeWidth={1.5} />
        <path d="M40 20h40" stroke="var(--ink)" strokeWidth={1.5} strokeLinecap="round" opacity={0.4} />
      </svg>
    </div>
  );
}

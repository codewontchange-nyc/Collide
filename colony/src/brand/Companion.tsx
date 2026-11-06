import { useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { companion } from "./companion";

const RING = [
  [32, 12],
  [49.3, 22],
  [49.3, 42],
  [32, 52],
  [14.7, 42],
  [14.7, 22],
] as const;

/** A living mark: breathes at rest, gathers when curating, nods when something is handled, speaks one line at a time. */
export function Companion({ size = 44 }: { size?: number }) {
  const s = useSyncExternalStore(companion.subscribe, companion.get, companion.get);
  const reduced = useReducedMotion();
  const breathe = !reduced && s.mood === "rest";

  return (
    <>
      <motion.div
        className="companion"
        style={{ width: size, height: size }}
        animate={s.mood === "nod" ? { rotate: [0, -6, 4, 0] } : { rotate: 0 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        aria-hidden
      >
        <svg viewBox="0 0 64 64" fill="none" width={size} height={size}>
          {RING.map(([cx, cy], i) => {
            const toCenter = s.mood === "gather";
            return (
              <motion.circle
                key={i}
                r={5}
                stroke="currentColor"
                strokeWidth={1.5}
                initial={false}
                animate={
                  toCenter
                    ? { cx: 32 + (cx - 32) * 0.35, cy: 32 + (cy - 32) * 0.35, opacity: 0.9 }
                    : breathe
                      ? { cx: [cx, 32 + (cx - 32) * 1.08, cx], cy: [cy, 32 + (cy - 32) * 1.08, cy], opacity: [0.75, 1, 0.75] }
                      : { cx, cy, opacity: 1 }
                }
                transition={
                  toCenter
                    ? { type: "spring", stiffness: 240, damping: 20 }
                    : breathe
                      ? { duration: 4, repeat: Infinity, ease: "easeInOut", delay: i * 0.12 }
                      : { type: "spring", stiffness: 240, damping: 20 }
                }
              />
            );
          })}
          <motion.circle
            cx={32}
            cy={32}
            r={5}
            fill="var(--honey)"
            initial={false}
            animate={s.mood === "nod" ? { r: [5, 7, 5] } : { r: 5 }}
            transition={{ duration: 0.4 }}
          />
        </svg>
      </motion.div>
      <AnimatePresence>
        {s.line && (
          <motion.div
            key={s.tick}
            className="companion-line"
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            role="status"
          >
            {s.line}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

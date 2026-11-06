import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import type { Transition, Variants } from "motion/react";

export const spring = {
  soft: { type: "spring", stiffness: 260, damping: 30, mass: 0.9 } as Transition,
  snappy: { type: "spring", stiffness: 420, damping: 32 } as Transition,
  slow: { type: "spring", stiffness: 120, damping: 22 } as Transition,
};

export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};

export const stagger = (delay = 0.04): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: delay, delayChildren: 0.02 } },
});

export const screenEnter: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1], staggerChildren: 0.035 } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12 } },
};

export const sheetVariants: Variants = {
  hidden: { y: "100%" },
  show: { y: 0, transition: spring.soft },
  exit: { y: "100%", transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
};

export const draw: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  show: { pathLength: 1, opacity: 1, transition: { duration: 0.6, ease: "easeInOut" } },
};

/** Animates a number toward `value`. Returns the in-flight number. */
export function useCountUp(value: number, duration = 0.8): number {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (reduced || prev.current === value) {
      prev.current = value;
      setShown(value);
      return;
    }
    const from = prev.current;
    prev.current = value;
    const ctrl = animate(from, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => ctrl.stop();
  }, [value, duration, reduced]);
  return shown;
}

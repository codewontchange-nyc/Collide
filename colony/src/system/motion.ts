/* The motion grammar, encoded once. Every value is the brief's section 5, verbatim:
   a thing appearing fades on neutral and lifts on enter in parallel; a thing leaving fades on exit;
   a thing changing state runs fast on standard; a live thing breathes on signal; groups stagger with a cap.
   Nothing here is a spring. Scripted motion reads useReducedMotion() and renders the final frame. */
import { useEffect, useMemo, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import type { Transition, Variants } from "motion/react";

export const ease = {
  neutral: [0.5, 0, 0.5, 1],
  enter: [0, 0, 0.2, 1],
  exit: [0.4, 0, 1, 1],
  standard: [0.4, 0, 0.2, 1],
  featureReveal: [0.16, 1, 0.3, 1],
  expressive: [0.2, 0, 0, 1],
  editorial: [0.22, 1, 0.36, 1],
  lineDraw: [0.3, 0.3, 0.65, 1],
  node: [0.25, 0.8, 0.3, 1],
  nodeExit: [0.7, 0, 0.75, 0.2],
  signal: [0.45, 0, 0.55, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** Durations in seconds. The CSS tokens carry the same values in ms. */
export const dur = { instant: 0.1, fast: 0.12, normal: 0.2, exitShort: 0.24, exit: 0.4, information: 0.48, slow: 0.8, entrance: 1.0, hero: 1.7 } as const;
/** Lift distances in px: sm for content and toasts, md for a dialog, lg for a sheet or hero. */
export const dist = { sm: 5, md: 8, lg: 12 } as const;
/** Stagger steps in seconds. */
export const stag = { xs: 0.055, sm: 0.08, md: 0.12, lg: 0.17 } as const;
/** delay = min(index * 55ms, 240ms), so a long list does not drift. */
export const cappedDelay = (index: number) => Math.min(index * stag.xs, 0.24);

/** appear: the fade rule. opacity on neutral, lift on enter, in parallel. */
export const appear = (duration: number = dur.information, lift: number = dist.sm): Variants => ({
  hidden: { opacity: 0, y: lift },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      opacity: { duration, ease: ease.neutral, delay: cappedDelay(i) },
      y: { duration, ease: ease.enter, delay: cappedDelay(i) },
    },
  }),
  exit: { opacity: 0, transition: { duration: dur.exitShort, ease: ease.exit } },
});

/** screen: a route change. Out 240ms on exit, in over the information pace with an 8px lift. */
export const screen: Variants = {
  hidden: { opacity: 0, y: dist.md },
  show: { opacity: 1, y: 0, transition: { opacity: { duration: dur.information, ease: ease.neutral }, y: { duration: dur.information, ease: ease.enter } } },
  exit: { opacity: 0, transition: { duration: dur.exitShort, ease: ease.exit } },
};

/** sheet: rises from the bottom on the feature reveal curve, leaves on exit. */
export const sheet: Variants = {
  hidden: { y: "100%" },
  show: { y: 0, transition: { duration: dur.normal * 3, ease: ease.featureReveal } },
  exit: { y: "100%", transition: { duration: dur.exitShort, ease: ease.exit } },
};

export const scrim: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: dur.normal, ease: ease.neutral } },
  exit: { opacity: 0, transition: { duration: dur.exitShort, ease: ease.exit } },
};

/** overlay: dialog and toast, the 200ms enter from a small lift. */
export const overlay = (lift: number = dist.md): Variants => ({
  hidden: { opacity: 0, y: lift },
  show: { opacity: 1, y: 0, transition: { duration: dur.normal, ease: ease.enter } },
  exit: { opacity: 0, transition: { duration: dur.exitShort, ease: ease.exit } },
});

/** shift: a state change. */
export const shift: Transition = { duration: dur.fast, ease: ease.standard };

/** press: shorter than hover. Rows, cards, chips, tabs and cells; never a Button. */
export const press = { whileTap: { scale: 0.99 }, transition: { duration: dur.instant, ease: ease.standard } };

/** settle: an indicator or sheet sliding under a tab: travel on standard. */
export const settle: Transition = { duration: dur.normal * 3, ease: ease.standard };

/** draw: a line drawing on. */
export const draw: Variants = {
  hidden: { pathLength: 0 },
  show: { pathLength: 1, transition: { duration: 1.1, ease: ease.lineDraw } },
};

/** grow: a card out of a point: a pill that rounds down to its own radius. */
export const grow: Variants = {
  hidden: { scaleX: 0.04, scaleY: 0.07, borderRadius: 999, opacity: 0.82 },
  show: { scaleX: 1, scaleY: 1, borderRadius: 1, opacity: 1, transition: { duration: 0.65, ease: ease.node } },
  exit: { scaleX: 0.04, scaleY: 0.07, borderRadius: 999, opacity: 0.82, transition: { duration: 0.46, ease: ease.nodeExit } },
};

/** pulse: a live dot. Prefer the CSS keyframes (ig-status-pulse); this is the same thing for a motion element. */
export const pulse = {
  animate: { scale: [0.9375, 1.0625, 0.9375], opacity: [0.45, 1, 0.45] },
  transition: { duration: 2.7, ease: ease.signal, repeat: Infinity },
};

/** The final frame, for reduced motion: the same three states with no duration and no lift. */
const still: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
};

/** Animates a number toward value over the slow duration on the editorial curve. Final value at once under reduced motion. */
export function useCountUp(value: number, duration = dur.slow): number {
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
      ease: ease.editorial,
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => ctrl.stop();
  }, [value, duration, reduced]);
  return reduced ? value : shown;
}

/** The fade rule as props to spread on a motion element. Respects reduced motion (duration 0, no lift).
 *  index staggers with cappedDelay. exit is the short chrome exit; pass exit: false for elements that never leave. */
export function useAppear(
  index = 0,
  opts: { duration?: number; lift?: number; exit?: boolean } = {},
): { variants: Variants; initial: "hidden"; animate: "show"; exit?: "exit"; custom: number } {
  const reduced = useReducedMotion();
  const { duration = dur.information, lift = dist.sm, exit = true } = opts;
  const variants = useMemo(() => (reduced ? still : appear(duration, lift)), [reduced, duration, lift]);
  if (exit) return { variants, initial: "hidden", animate: "show", exit: "exit", custom: index };
  return { variants, initial: "hidden", animate: "show", custom: index };
}

/** True when the OS asks for reduced motion. Re export of motion's hook so components import one module. */
export { useReducedMotion } from "motion/react";

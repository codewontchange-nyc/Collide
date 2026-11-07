import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import type { Variants } from "motion/react";
import { DotGrid } from "@/system/DotGrid/DotGrid";
import { dist, dur, overlay, useReducedMotion } from "@/system/motion";
import { toast } from "@/system/Toast/Toast";
import { useOverlaySlot } from "@/system/Toast/overlaySlot";
import { companion, type Mood } from "./companion";

/* The lit sets on the 25 cells, reading order. Dots never move: every mood is a cross fade between two of these. */
const SETTLED = [7, 11, 12, 13, 17];
const ALL = Array.from({ length: 25 }, (_, i) => i);
const ONE = [12];
const BLOCK = [6, 7, 8, 11, 12, 13, 16, 17, 18];

/* Timings, in ms, from the motion grammar: gather lights 20ms per dot (500ms), holds, collapses on the exit duration;
   nod fills on fast and returns on the exit; the enter ripples 110ms per ring (520ms for the kit's glyph). */
const GATHER_STEP_MS = 20;
const GATHER_HOLD_MS = dur.normal * 1000;
const EXIT_MS = dur.exitShort * 1000;
const NOD_RETURN_MS = dur.exit * 1000;
const ENTER_MS = 520;

type Phase = "enter" | "rest" | "gather" | "collapse" | "return-gather" | "nod" | "return-nod";

function litArray(indices: number[]): boolean[] {
  const set = new Set(indices);
  return ALL.map((i) => set.has(i));
}

const still: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
};

/** The living mark: a 5 by 5 dot grid in a 44px box that breathes at rest, gathers while Colony curates, nods when
 *  something is handled, and speaks one line at a time through the inverted bubble. Not a target; aria-hidden.
 *  mood overrides the store for a specimen or the request sheet's curating grid (and then shows no bubble). */
export function Companion({ mood, className }: { mood?: Mood; className?: string }) {
  const s = useSyncExternalStore(companion.subscribe, companion.get, companion.get);
  const reduced = useReducedMotion();
  const slot = useOverlaySlot();
  const current: Mood = mood ?? s.mood;
  const [phase, setPhase] = useState<Phase>(reduced ? "rest" : "enter");
  const [lit, setLit] = useState<number[]>(SETTLED);
  const prevMood = useRef<Mood>(current);

  /* enter: the rings settle in from the center, then the mark rests */
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setPhase((p) => (p === "enter" ? "rest" : p)), ENTER_MS + dur.normal * 1000);
    return () => clearTimeout(t);
  }, [reduced]);

  /* moods: each is a cross fade between lit sets, timed here, eased by the phase attribute in Companion.css */
  useEffect(() => {
    if (reduced) {
      setLit(SETTLED);
      setPhase("rest");
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
    const was = prevMood.current;
    prevMood.current = current;
    if (current === "gather") {
      setPhase("gather");
      const order = ALL.filter((i) => !SETTLED.includes(i));
      order.forEach((idx, k) => later(() => setLit((cur) => (cur.includes(idx) ? cur : [...cur, idx])), (k + 1) * GATHER_STEP_MS));
      later(() => {
        setPhase("collapse");
        setLit(ONE);
      }, order.length * GATHER_STEP_MS + GATHER_HOLD_MS);
    } else if (current === "nod") {
      setPhase("nod");
      setLit(BLOCK);
    } else {
      setLit(SETTLED);
      if (was === "gather") {
        setPhase("return-gather");
        later(() => setPhase("rest"), EXIT_MS);
      } else if (was === "nod") {
        setPhase("return-nod");
        later(() => setPhase("rest"), NOD_RETURN_MS);
      } else {
        setPhase((p) => (p === "enter" ? p : "rest"));
      }
    }
    return () => timers.forEach((t) => clearTimeout(t));
  }, [current, reduced]);

  /* the bubble: hold the toasts for the line's life, route the next 300ms of toasts into the second line (Toast.tsx owns the rules) */
  const storeDriven = mood === undefined;
  useEffect(() => {
    if (!storeDriven) return;
    if (!s.line) {
      toast.bubbleLeft();
      return;
    }
    toast.bubble(s.line, s.lineMs + EXIT_MS, companion.annotate);
  }, [storeDriven, s.line, s.lineMs, s.lineId]);
  useEffect(() => {
    if (!storeDriven) return;
    return () => toast.bubbleLeft();
  }, [storeDriven]);

  const resting = phase === "rest";
  const shownLit = resting && !reduced ? Array.from(new Set([...SETTLED, 6, 8, 16, 18])) : lit;
  const cls = ["ig-companion", className].filter(Boolean).join(" ");
  const variants = reduced ? still : overlay(dist.md);

  const bubble =
    storeDriven && typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {s.line && (
              <motion.div key={s.lineId} className="ig-companion__line paragraph-small" role="status" variants={variants} initial="hidden" animate="show" exit="exit">
                <span className="ig-companion__said">{s.line}</span>
                {s.body && <span className="ig-companion__body paragraph-x-small">{s.body}</span>}
              </motion.div>
            )}
          </AnimatePresence>,
          slot ?? document.body,
        )
      : null;

  return (
    <>
      <span className={cls} data-mood={current} data-phase={phase} aria-hidden="true">
        <DotGrid size="md" lit={litArray(shownLit)} settle={phase === "enter"} settleOrder="center" className="ig-companion__mark" />
      </span>
      {bubble}
    </>
  );
}

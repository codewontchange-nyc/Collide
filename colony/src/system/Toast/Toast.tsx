import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import type { Variants } from "motion/react";
import { dist, overlay, useReducedMotion } from "@/system/motion";
import { Notice, type NoticeKind } from "@/system/Notice/Notice";
import { useOverlaySlot } from "@/system/Toast/overlaySlot";

export interface ToastItem {
  id: number;
  text: string;
  kind?: NoticeKind;
  action?: { label: string; onClick: () => void };
  sticky?: boolean;
}

type ShowOpts = { action?: ToastItem["action"]; sticky?: boolean; ms?: number; kind?: NoticeKind };
type Queued = ToastItem & { ms: number };

/* The store. Shown toasts, a queue for the hold, and the companion's bubble so the three sequencing rules can run:
   a toast fired within 300ms of a line becomes the bubble's second line; a toast that repeats the line is dropped;
   any other non sticky toast waits until the bubble leaves. At most two show; a third replaces the oldest. */
const DEFAULT_MS = 2400;
const MAX_VISIBLE = 2;
const ANNOTATE_WINDOW_MS = 300;

let shown: ToastItem[] = [];
let queue: Queued[] = [];
let seq = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const subs = new Set<() => void>();
const emit = () => subs.forEach((fn) => fn());

let holdUntil = 0;
let holdTimer: ReturnType<typeof setTimeout> | undefined;
let bubble: { line: string; at: number; annotate: (text: string) => void } | null = null;

const holding = () => holdUntil > Date.now();

function clearTimer(id: number) {
  const t = timers.get(id);
  if (t !== undefined) {
    clearTimeout(t);
    timers.delete(id);
  }
}

function place(item: ToastItem, ms: number) {
  /* sticky dedupe by text: a second "update ready" replaces the first */
  const replaced = shown.filter((t) => t.sticky && t.text === item.text);
  replaced.forEach((t) => clearTimer(t.id));
  let next = [...shown.filter((t) => !(t.sticky && t.text === item.text)), item];
  while (next.length > MAX_VISIBLE) {
    clearTimer(next[0].id);
    next = next.slice(1);
  }
  shown = next;
  if (!item.sticky) timers.set(item.id, setTimeout(() => toast.dismiss(item.id), ms));
  emit();
}

/* Let queued toasts through, in order, while there is room and no hold. */
function pump() {
  while (!holding() && queue.length > 0 && shown.length < MAX_VISIBLE) {
    const next = queue.shift()!;
    const { ms, ...item } = next;
    place(item, ms);
  }
}

function release() {
  holdUntil = 0;
  if (holdTimer !== undefined) {
    clearTimeout(holdTimer);
    holdTimer = undefined;
  }
  pump();
}

export const toast = {
  /** Show a toast. Returns its id. Non sticky toasts leave after ms (default 2400); sticky ones stay until dismissed and dedupe by text. */
  show(text: string, opts: ShowOpts = {}): number {
    const id = ++seq;
    const item: ToastItem = { id, text, kind: opts.kind, action: opts.action, sticky: opts.sticky };
    if (!item.sticky && bubble) {
      /* the bubble's rules: a repeat is dropped; a toast right after a line becomes its second line */
      if (text === bubble.line) return id;
      if (Date.now() - bubble.at <= ANNOTATE_WINDOW_MS) {
        bubble.annotate(text);
        return id;
      }
    }
    const ms = opts.ms ?? DEFAULT_MS;
    if (!item.sticky && (holding() || queue.length > 0)) {
      queue.push({ ...item, ms });
      pump();
      return id;
    }
    place(item, ms);
    return id;
  },
  dismiss(id: number): void {
    clearTimer(id);
    const before = shown.length + queue.length;
    shown = shown.filter((t) => t.id !== id);
    queue = queue.filter((t) => t.id !== id);
    if (shown.length + queue.length !== before) emit();
    pump();
  },
  /** Queue every non sticky toast fired during the next ms; they show in order when the hold ends. The Companion calls it on say. */
  hold(ms: number): void {
    const until = Date.now() + Math.max(0, ms);
    if (until <= holdUntil) return;
    holdUntil = until;
    if (holdTimer !== undefined) clearTimeout(holdTimer);
    holdTimer = setTimeout(release, Math.max(0, ms));
  },
  /** The companion's bubble is up: hold for its life, route the next 300ms of toasts to annotate, drop a toast that repeats the line. */
  bubble(line: string, ms: number, annotate: (text: string) => void): void {
    bubble = { line, at: Date.now(), annotate };
    toast.hold(ms);
  },
  /** The bubble left (its timer, or an early rest): end the hold now and let the queue through. */
  bubbleLeft(): void {
    bubble = null;
    release();
  },
  /** The shown toasts, newest last. */
  get(): ToastItem[] {
    return shown;
  },
  subscribe(fn: () => void): () => void {
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  },
  /** Drop everything, shown and queued. For tests and the demo reset. */
  clear(): void {
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
    shown = [];
    queue = [];
    bubble = null;
    release();
    emit();
  },
};

/** The shown toasts, as a hook. */
export function useToasts(): ToastItem[] {
  return useSyncExternalStore(toast.subscribe, toast.get, toast.get);
}

/* The final frame for reduced motion: no lift, no duration. */
const still: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
};

/** The fixed host above the tab bar (and the FAB, through --fab-clearance), one Notice toast per item, newest last.
 *  Enter is the CSS keyframe on the toast; exit is overlay(dist.sm). Portals into the open sheet's overlay slot so a modal never hides it. */
export function ToastHost() {
  const list = useToasts();
  const slot = useOverlaySlot();
  const reduced = useReducedMotion();
  const variants = reduced ? still : overlay(dist.sm);
  const host = (
    <div className="ig-toast-host" aria-live="polite">
      <AnimatePresence initial={false}>
        {list.map((t) => (
          <motion.div key={t.id} className="ig-toast-host__item" variants={variants} initial={false} animate="show" exit="exit">
            <Notice
              placement="toast"
              kind={t.kind}
              action={
                t.action
                  ? {
                      label: t.action.label,
                      onClick: () => {
                        t.action?.onClick();
                        toast.dismiss(t.id);
                      },
                    }
                  : undefined
              }
              onDismiss={t.sticky ? () => toast.dismiss(t.id) : undefined}
            >
              {t.text}
            </Notice>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
  if (typeof document === "undefined") return host;
  return createPortal(host, slot ?? document.body);
}

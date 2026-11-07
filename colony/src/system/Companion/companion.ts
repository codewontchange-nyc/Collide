// The companion is a tiny external store so any action can make the mark react.
// Moved from src/brand/companion.ts with two additions: rest() and annotate(), plus the exported Mood type.
// say() arms the toast store's bubble rules here, at say time, so a toast fired synchronously after it (the normal pattern:
// companion.say(...); toast.show(...)) is already routed to annotate before the Companion re renders. Toast.tsx never imports this file.
import { toast } from "@/system/Toast/Toast";
import { dur } from "@/system/motion";

export type Mood = "rest" | "gather" | "nod";
export interface CompanionState {
  mood: Mood;
  /** the bubble's line, or null when it is quiet */
  line: string | null;
  /** the bubble's second line (a toast merged in while the line shows) */
  body: string | null;
  /** how long the current line stays, in ms (the Companion holds toasts for it) */
  lineMs: number;
  /** counts up on every say, so the same line said twice still re enters */
  lineId: number;
  tick: number;
}

let state: CompanionState = { mood: "rest", line: null, body: null, lineMs: 0, lineId: 0, tick: 0 };
const subs = new Set<() => void>();
let lineTimer: ReturnType<typeof setTimeout> | undefined;
let leaveTimer: ReturnType<typeof setTimeout> | undefined;
let moodTimer: ReturnType<typeof setTimeout> | undefined;

/* the bubble leaves over the short chrome exit; the hold on toasts outlives the line by that much */
const EXIT_MS = dur.exitShort * 1000;

function emit(next: Partial<CompanionState>) {
  state = { ...state, ...next, tick: state.tick + 1 };
  subs.forEach((fn) => fn());
}

export const companion = {
  get: () => state,
  subscribe(fn: () => void) {
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  },
  /** Speak one line in voice; it fades after a moment. Arms the toast store: a toast fired within 300ms becomes the second line,
   *  a repeat of the line is dropped, any other toast waits until the bubble has left (one thing at a time). */
  say(line: string, ms = 2600) {
    clearTimeout(lineTimer);
    clearTimeout(leaveTimer);
    emit({ line, body: null, lineMs: ms, lineId: state.lineId + 1, mood: "nod" });
    toast.bubble(line, ms + EXIT_MS, companion.annotate);
    lineTimer = setTimeout(() => {
      emit({ line: null, body: null, mood: "rest" });
      leaveTimer = setTimeout(() => toast.bubbleLeft(), EXIT_MS);
    }, ms);
  },
  /** Set the bubble's second line while a line shows (a toast merged in). Ignored when the companion is quiet. */
  annotate(text: string) {
    if (!state.line) return;
    emit({ body: text });
  },
  /** Gather the cells into the center while Colony is curating. */
  gather(ms = 900) {
    clearTimeout(moodTimer);
    emit({ mood: "gather" });
    moodTimer = setTimeout(() => emit({ mood: "rest" }), ms);
  },
  /** Cancel a gather or a nod at once (a long press released early). */
  rest() {
    clearTimeout(moodTimer);
    if (state.mood !== "rest") emit({ mood: "rest" });
  },
  /** Something got handled. */
  nod() {
    clearTimeout(moodTimer);
    emit({ mood: "nod" });
    moodTimer = setTimeout(() => emit({ mood: "rest" }), 700);
  },
};

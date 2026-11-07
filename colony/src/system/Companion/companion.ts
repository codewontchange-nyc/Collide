// The companion is a tiny external store so any action can make the mark react.
// Moved from src/brand/companion.ts with two additions: rest() and annotate(), plus the exported Mood type.
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
let moodTimer: ReturnType<typeof setTimeout> | undefined;

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
  /** Speak one line in voice; it fades after a moment. */
  say(line: string, ms = 2600) {
    clearTimeout(lineTimer);
    emit({ line, body: null, lineMs: ms, lineId: state.lineId + 1, mood: "nod" });
    lineTimer = setTimeout(() => emit({ line: null, body: null, mood: "rest" }), ms);
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

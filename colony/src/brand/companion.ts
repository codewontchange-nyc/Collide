// The companion is a tiny external store so any action can make the mark react.
type Mood = "rest" | "gather" | "nod";
interface CompanionState { mood: Mood; line: string | null; tick: number }

let state: CompanionState = { mood: "rest", line: null, tick: 0 };
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
    emit({ line, mood: "nod" });
    lineTimer = setTimeout(() => emit({ line: null, mood: "rest" }), ms);
  },
  /** Gather the cells into the center while Colony is curating. */
  gather(ms = 900) {
    clearTimeout(moodTimer);
    emit({ mood: "gather" });
    moodTimer = setTimeout(() => emit({ mood: "rest" }), ms);
  },
  /** Something got handled. */
  nod() {
    clearTimeout(moodTimer);
    emit({ mood: "nod" });
    moodTimer = setTimeout(() => emit({ mood: "rest" }), 700);
  },
};

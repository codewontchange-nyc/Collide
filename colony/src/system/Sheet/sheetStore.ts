import { useSyncExternalStore } from "react";

// Which sheet is open and what it points at. One at a time. History aware so hardware back closes it.
export type SheetSpec =
  | { kind: "meal"; id: string }
  | { kind: "visit"; id: string }
  | { kind: "provider"; id: string }
  | { kind: "person"; id: string }
  | { kind: "household"; id: string }
  | { kind: "task"; id: string }
  | { kind: "request"; homeId?: string; category?: string }
  | { kind: "match"; needId: string }
  | { kind: "pool" }
  | { kind: "allocation"; engagementId: string }
  | { kind: "invite" }
  | { kind: "bring" }
  | { kind: "manifesto" }
  | { kind: "advance" };

let current: SheetSpec | null = null;
let pushed = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((fn) => fn());

export const sheets = {
  get: () => current,
  subscribe(fn: () => void) {
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  },
  open(spec: SheetSpec) {
    current = spec;
    if (typeof window !== "undefined" && !pushed) {
      window.history.pushState({ sheet: true }, "");
      pushed = true;
    }
    emit();
  },
  /** Replace the open sheet without another history entry (request -> match). */
  swap(spec: SheetSpec) {
    current = spec;
    emit();
  },
  close() {
    if (!current) return;
    current = null;
    emit();
    if (typeof window !== "undefined" && pushed) {
      pushed = false;
      window.history.back();
    }
  },
};

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    if (current) {
      current = null;
      pushed = false;
      emit();
    }
  });
}

export function useSheet() {
  return useSyncExternalStore(sheets.subscribe, sheets.get, sheets.get);
}

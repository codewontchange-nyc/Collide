// A tiny external store. The whole colony is one immutable object; actions replace it.
import { useSyncExternalStore } from "react";
import type { ColonyState } from "@/domain/types";
import { todayStr } from "@/domain/dates";
import { buildSeed } from "@/seed/seed";

export interface Store<T> {
  get(): T;
  set(updater: (state: T) => T): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(updater) {
      const next = updater(state);
      if (Object.is(next, state)) return;
      state = next;
      for (const l of Array.from(listeners)) l();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The app's one store. Starts on the seed so nothing is ever null; StoreProvider swaps in what was saved. */
export const store: Store<ColonyState> = createStore<ColonyState>(buildSeed(todayStr()));

/** The root state. Derive with useMemo in the component; the getter never allocates. */
export function useColonyState(): ColonyState {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

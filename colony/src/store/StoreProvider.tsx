// Loads the colony from the repo on boot, seeds when there is nothing, saves on every change.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { ColonyRepo } from "@/data/repo";
import { LocalRepo } from "@/data/localRepo";
import { todayStr } from "@/domain/dates";
import { buildSeed } from "@/seed/seed";
import { store } from "@/store/store";

const ReadyContext = createContext(false);
const SAVE_DEBOUNCE_MS = 150;

export interface StoreProviderProps {
  repo?: ColonyRepo;
  fallback?: ReactNode;
  children: ReactNode;
}

export function StoreProvider({ repo, fallback = null, children }: StoreProviderProps) {
  const [ready, setReady] = useState(false);
  const [activeRepo] = useState<ColonyRepo>(() => repo ?? new LocalRepo());

  useEffect(() => {
    let alive = true;
    activeRepo
      .load()
      .then((saved) => {
        if (!alive) return;
        // buildSeed starts with onboarded false, so a fresh install lands on Welcome.
        const next = saved ?? buildSeed(todayStr());
        store.set(() => next);
        if (!saved) void activeRepo.save(next);
        setReady(true);
      })
      .catch(() => {
        if (!alive) return;
        store.set(() => buildSeed(todayStr()));
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [activeRepo]);

  useEffect(() => {
    if (!ready) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = store.subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        void activeRepo.save(store.get());
      }, SAVE_DEBOUNCE_MS);
    });
    return () => {
      unsubscribe();
      if (timer) {
        clearTimeout(timer);
        void activeRepo.save(store.get());
      }
    };
  }, [ready, activeRepo]);

  return <ReadyContext.Provider value={ready}>{ready ? children : fallback}</ReadyContext.Provider>;
}

export function useReady(): boolean {
  return useContext(ReadyContext);
}

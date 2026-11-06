// localStorage persistence for the demo, and an in-memory twin for tests.
import type { ColonyState } from "@/domain/types";
import type { ColonyRepo } from "@/data/repo";
import { SEED_VERSION } from "@/seed/seed";

export const STORAGE_KEY = "colony.state.v1";

function storage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function isColonyState(x: unknown): x is ColonyState {
  if (!x || typeof x !== "object") return false;
  const s = x as Partial<ColonyState>;
  return !!s.colony && Array.isArray(s.people) && !!s.meta && typeof s.meta.seedVersion === "number";
}

export class LocalRepo implements ColonyRepo {
  constructor(private readonly key: string = STORAGE_KEY) {}

  async load(): Promise<ColonyState | null> {
    const store = storage();
    if (!store) return null;
    try {
      const raw = store.getItem(this.key);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!isColonyState(parsed)) return null;
      if (parsed.meta.seedVersion !== SEED_VERSION) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  async save(state: ColonyState): Promise<void> {
    const store = storage();
    if (!store) return;
    try {
      store.setItem(this.key, JSON.stringify(state));
    } catch {
      // Quota or private mode. The demo keeps running in memory.
    }
  }

  async clear(): Promise<void> {
    const store = storage();
    if (!store) return;
    try {
      store.removeItem(this.key);
    } catch {
      // nothing to do
    }
  }
}

export class MemoryRepo implements ColonyRepo {
  private raw: string | null = null;

  async load(): Promise<ColonyState | null> {
    if (this.raw === null) return null;
    const parsed = JSON.parse(this.raw) as ColonyState;
    return parsed.meta.seedVersion === SEED_VERSION ? parsed : null;
  }

  async save(state: ColonyState): Promise<void> {
    this.raw = JSON.stringify(state);
  }

  async clear(): Promise<void> {
    this.raw = null;
  }
}

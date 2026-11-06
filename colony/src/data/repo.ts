import type { ColonyState } from "@/domain/types";

// The one seam between the app and wherever state lives.
// LocalRepo persists the demo; SupabaseRepo is the stub to wire later.
export interface ColonyRepo {
  load(): Promise<ColonyState | null>;
  save(state: ColonyState): Promise<void>;
  clear(): Promise<void>;
}

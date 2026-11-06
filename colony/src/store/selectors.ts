// Id maps memoized per state object. Same state in, same map out, no allocation on re-render.
import type { ColonyState, Engagement, Home, Household, Need, Person, Provider } from "@/domain/types";
import { useColonyState } from "@/store/store";

function memo<T>(derive: (state: ColonyState) => T): (state: ColonyState) => T {
  const cache = new WeakMap<ColonyState, T>();
  return (state) => {
    const hit = cache.get(state);
    if (hit !== undefined) return hit;
    const value = derive(state);
    cache.set(state, value);
    return value;
  };
}

function indexBy<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((x) => [x.id, x]));
}

export const personById = memo((s): Map<string, Person> => indexBy(s.people));
export const homeById = memo((s): Map<string, Home> => indexBy(s.homes));
export const householdById = memo((s): Map<string, Household> => indexBy(s.households));
export const providerById = memo((s): Map<string, Provider> => indexBy(s.providers));
export const engagementById = memo((s): Map<string, Engagement> => indexBy(s.engagements));
export const needById = memo((s): Map<string, Need> => indexBy(s.needs));

export interface Maps {
  people: Map<string, Person>;
  homes: Map<string, Home>;
  households: Map<string, Household>;
  providers: Map<string, Provider>;
  engagements: Map<string, Engagement>;
  needs: Map<string, Need>;
}

export const mapsOf = memo(
  (s): Maps => ({
    people: personById(s),
    homes: homeById(s),
    households: householdById(s),
    providers: providerById(s),
    engagements: engagementById(s),
    needs: needById(s),
  }),
);

export function useMaps(): Maps {
  return mapsOf(useColonyState());
}

/** The member the app is showing as, or the steward when the persona is a provider. */
export function currentPerson(state: ColonyState): Person | undefined {
  const id = state.meta.persona.mode === "member" ? state.meta.persona.personId : state.colony.stewardId;
  return personById(state).get(id);
}

export function currentProvider(state: ColonyState): Provider | undefined {
  if (state.meta.persona.mode !== "provider") return undefined;
  return providerById(state).get(state.meta.persona.providerId);
}

/** The home of the current member, or the first home. */
export function currentHome(state: ColonyState): Home | undefined {
  const person = currentPerson(state);
  const hh = person ? householdById(state).get(person.householdId) : undefined;
  return (hh ? homeById(state).get(hh.homeId) : undefined) ?? state.homes[0];
}

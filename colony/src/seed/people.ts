// The demo colony: two Brooklyn households, four people.
import type { Colony, DateStr, Home, Household, Person } from "@/domain/types";
import { addMonths, firstOfMonth, monthOf } from "@/domain/dates";
import { MEMBERSHIP_PRICE_CENTS } from "@/domain/membership";

export const COLONY_ID = "col_dekalb";
export const COLONY_NAME = "Dekalb & Bergen";
export const INVITE_CODE = "HIVE-4821";
export const CONTRIBUTION_CENTS = 100000;
export const HISTORY_MONTHS = 5;

export function avatarFor(name: string): string {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(name)}&backgroundColor=f5ece2`;
}

export const HOMES: Home[] = [
  {
    id: "home_dekalb",
    householdId: "hh_dekalb",
    label: "Dekalb Ave",
    address: "Dekalb Ave, Clinton Hill, Brooklyn",
    area: "Clinton Hill",
    lat: 40.6897,
    lng: -73.966,
    plantCount: 14,
    notes: "Third floor walk-up. Key under the brass planter. Radiators run hot.",
  },
  {
    id: "home_bergen",
    householdId: "hh_bergen",
    label: "Bergen St",
    address: "Bergen St, Boerum Hill, Brooklyn",
    area: "Boerum Hill",
    lat: 40.6865,
    lng: -73.9856,
    plantCount: 9,
    notes: "Garden level, side gate code 4821. Dog is friendly, named Pickle.",
  },
];

export const HOUSEHOLDS: Household[] = [
  { id: "hh_dekalb", name: "Dekalb", homeId: "home_dekalb", personIds: ["p_noor", "p_elias"] },
  { id: "hh_bergen", name: "Bergen", homeId: "home_bergen", personIds: ["p_priya", "p_theo"] },
];

export const PEOPLE: Person[] = [
  {
    id: "p_noor",
    name: "Noor Haddad",
    avatar: avatarFor("Noor Haddad"),
    householdId: "hh_dekalb",
    role: "steward",
    contributionCents: CONTRIBUTION_CENTS,
    bio: "Started the colony after one too many Sunday nights spent meal prepping.",
  },
  {
    id: "p_elias",
    name: "Elias Brandt",
    avatar: avatarFor("Elias Brandt"),
    householdId: "hh_dekalb",
    role: "member",
    contributionCents: CONTRIBUTION_CENTS,
    bio: "Keeps the plant count honest.",
  },
  {
    id: "p_priya",
    name: "Priya Natarajan",
    avatar: avatarFor("Priya Natarajan"),
    householdId: "hh_bergen",
    role: "member",
    contributionCents: CONTRIBUTION_CENTS,
    bio: "Brought Ines in, and most of the good restaurant tips.",
  },
  {
    id: "p_theo",
    name: "Theo Lindqvist",
    avatar: avatarFor("Theo Lindqvist"),
    householdId: "hh_bergen",
    role: "member",
    contributionCents: CONTRIBUTION_CENTS,
    bio: "Found Jordan. Has opinions about closet swaps.",
  },
];

/** The month the colony started: five closed months before today's month. */
export function startMonth(today: DateStr): string {
  return addMonths(monthOf(today), -HISTORY_MONTHS);
}

export function buildColony(today: DateStr): Colony {
  return {
    id: COLONY_ID,
    name: COLONY_NAME,
    createdAt: firstOfMonth(startMonth(today)),
    stewardId: "p_noor",
    inviteCode: INVITE_CODE,
    contributionCentsPerPerson: CONTRIBUTION_CENTS,
    membership: {
      plan: "colony",
      priceCents: MEMBERSHIP_PRICE_CENTS,
      status: "trialing",
      trialEndsAt: today,
      periodEnd: today,
      cancelAtPeriodEnd: false,
    },
  };
}

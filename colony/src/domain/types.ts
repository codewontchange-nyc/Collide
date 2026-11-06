// Colony domain types. Money is integer cents. Dates are "YYYY-MM-DD", months are "YYYY-MM".
// Everything here is plain data so it can live in localStorage today and Postgres tomorrow.

export type Id = string;
export type DateStr = string; // YYYY-MM-DD
export type MonthStr = string; // YYYY-MM
export type TimeStr = string; // HH:MM, 24h
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

export type Skill =
  | "cooking"
  | "cleaning"
  | "laundry"
  | "shopping"
  | "house_manager"
  | "plants"
  | "handyman"
  | "plumbing"
  | "electrical"
  | "hvac"
  | "pest"
  | "sewing"
  | "seasonal";

export type Fund = "direct" | "indirect";

export interface Person {
  id: Id;
  name: string;
  avatar: string; // url or empty, Avatar falls back to initials
  householdId: Id;
  role: "steward" | "member";
  contributionCents: number;
  bio?: string;
}

export interface Household {
  id: Id;
  name: string;
  homeId: Id;
  personIds: Id[];
}

export interface Home {
  id: Id;
  householdId: Id;
  label: string; // "Dekalb Ave"
  address: string;
  area: string; // neighborhood
  lat: number;
  lng: number;
  plantCount: number;
  notes: string;
}

export interface AvailabilityWindow {
  day: Weekday;
  from: TimeStr;
  to: TimeStr;
}

export interface Provider {
  id: Id;
  name: string;
  avatar: string;
  skills: Skill[];
  primary: Skill;
  kind: Fund; // direct = recurring people, indirect = pool-funded specialists
  bio: string;
  roleLine: string; // in voice: "Keeps the plants alive"
  area: string;
  lat: number;
  lng: number;
  radiusKm: number;
  rateCents: number;
  rateUnit: "visit" | "hour";
  rating: number; // 0..5
  homesServed: number;
  availability: AvailabilityWindow[];
  broughtBy?: Id; // person id when a member brought them
  curated: boolean; // true when Colony matched them
}

export type Cadence =
  | { kind: "weekly"; days: Weekday[]; time: TimeStr }
  | { kind: "biweekly"; day: Weekday; time: TimeStr; anchor: DateStr }
  | { kind: "monthly"; dayOfMonth: number; time: TimeStr }
  | { kind: "once"; date: DateStr; time: TimeStr };

export interface Engagement {
  id: Id;
  providerId: Id;
  skill: Skill;
  cadence: Cadence;
  homeIds: Id[]; // each occurrence covers every listed home
  costCents: number; // per occurrence, all homes together
  fund: Fund;
  startsOn: DateStr;
  label: string; // "Dinners, Mon and Thu"
  durationMin: number;
}

export type ScheduleKind =
  | "meal"
  | "clean"
  | "laundry"
  | "plants"
  | "maintenance"
  | "seasonal"
  | "shopping"
  | "visit";

export interface ScheduleItem {
  id: Id;
  engagementId?: Id;
  needId?: Id;
  providerId: Id;
  homeId: Id;
  date: DateStr;
  start: TimeStr;
  end: TimeStr;
  kind: ScheduleKind;
  title: string;
  status: "planned" | "done" | "skipped";
}

export interface Meal {
  id: Id;
  date: DateStr;
  title: string;
  cuisine: string;
  chefId: Id;
  homeIds: Id[];
  tags: string[];
  scheduleItemId: Id; // the chef visit that produced it
  status: "planned" | "served";
}

export type TaskStatus = "handled" | "scheduled" | "queued" | "needs_you";
export type TaskSource = "seasonal" | "maintenance" | "member" | "provider" | "match";

export interface Task {
  id: Id;
  title: string;
  category: Skill;
  homeId?: Id;
  status: TaskStatus;
  handledBy?: Id; // provider id
  dueOn: DateStr;
  source: TaskSource;
  needId?: Id;
  note?: string;
}

export type Urgency = "whenever" | "this_week" | "soon" | "urgent";

export interface Need {
  id: Id;
  title: string;
  note: string;
  category: Skill;
  homeId: Id;
  urgency: Urgency;
  status: "open" | "matching" | "matched" | "scheduled" | "done";
  createdBy: Id;
  createdAt: DateStr;
  matchIds: Id[];
}

export interface Match {
  id: Id;
  needId: Id;
  providerId: Id;
  score: number;
  reasons: string[];
  quoteCents: number;
  earliest: DateStr;
  status: "suggested" | "accepted" | "declined";
}

export interface BudgetPeriod {
  id: Id;
  month: MonthStr;
  contributionCents: number;
  directCents: number;
  leftoverCents: number; // contribution minus direct, can be negative (flagged, never rolled)
  rolloverInCents: number; // what actually entered the pool when the month closed
  indirectCents: number; // pool spend during the month
  closedAt?: DateStr;
}

export type LedgerKind = "contribution" | "direct" | "indirect" | "rollover_in" | "membership";

export interface LedgerEntry {
  id: Id;
  month: MonthStr;
  date: DateStr;
  kind: LedgerKind;
  cents: number; // positive amounts; kind says the direction
  providerId?: Id;
  personId?: Id;
  note: string;
}

export type MembershipStatus = "trialing" | "active" | "past_due" | "canceled";

export interface Membership {
  plan: "colony";
  priceCents: number;
  status: MembershipStatus;
  trialEndsAt: DateStr;
  periodEnd: DateStr;
  cancelAtPeriodEnd: boolean;
}

export interface Colony {
  id: Id;
  name: string;
  createdAt: DateStr;
  stewardId: Id;
  inviteCode: string;
  contributionCentsPerPerson: number;
  membership: Membership;
}

export type Persona = { mode: "member"; personId: Id } | { mode: "provider"; providerId: Id };

export interface Meta {
  seedVersion: number;
  onboarded: boolean;
  simToday: DateStr; // the demo clock
  persona: Persona;
}

export interface ColonyState {
  colony: Colony;
  people: Person[];
  households: Household[];
  homes: Home[];
  providers: Provider[];
  engagements: Engagement[];
  schedule: ScheduleItem[];
  meals: Meal[];
  tasks: Task[];
  needs: Need[];
  matches: Match[];
  periods: BudgetPeriod[];
  ledger: LedgerEntry[];
  meta: Meta;
}

// Indirect service catalog: what the pool can fund.
export interface CatalogItem {
  id: Id;
  title: string;
  skill: Skill;
  estCents: number;
  typicalHours: number;
  cadenceHint: string; // "Every fall", "Twice a year"
  season?: number[]; // months 1..12 when it is typically due
}

// Seasonal and preventative tasks that generate passive todos.
export interface SeasonalTask {
  id: Id;
  title: string;
  skill: Skill;
  months: number[]; // 1..12
  catalogId?: Id; // when the pool funds it
  perHome: boolean;
}

export const SKILL_LABEL: Record<Skill, string> = {
  cooking: "Cooking",
  cleaning: "Cleaning",
  laundry: "Laundry",
  shopping: "Shopping",
  house_manager: "House manager",
  plants: "Plants",
  handyman: "Handyman",
  plumbing: "Plumbing",
  electrical: "Electrical",
  hvac: "Heating and cooling",
  pest: "Pest control",
  sewing: "Sewing and repairs",
  seasonal: "Seasonal prep",
};

export const DIRECT_SKILLS: Skill[] = ["cooking", "cleaning", "laundry", "shopping", "house_manager", "plants"];
export const INDIRECT_SKILLS: Skill[] = ["handyman", "plumbing", "electrical", "hvac", "pest", "sewing", "seasonal"];

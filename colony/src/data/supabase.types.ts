// Hand-written Database type matching supabase/schema.sql, for createClient<Database>.
// NOT WIRED: nothing imports this at runtime yet. Keep it in step with the SQL by hand
// (or replace it with `supabase gen types typescript` output once a project exists).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Uuid = string;
type Timestamp = string; // ISO timestamptz
type DateCol = string; // YYYY-MM-DD
type TimeCol = string; // HH:MM:SS
type MonthCol = string; // YYYY-MM

export type DbSkill =
  | "cooking" | "cleaning" | "laundry" | "shopping" | "house_manager" | "plants"
  | "handyman" | "plumbing" | "electrical" | "hvac" | "pest" | "sewing" | "seasonal";
export type DbFund = "direct" | "indirect";
export type DbRole = "steward" | "member";
export type DbRateUnit = "visit" | "hour";
export type DbScheduleKind = "meal" | "clean" | "laundry" | "plants" | "maintenance" | "seasonal" | "shopping" | "visit";
export type DbScheduleStatus = "planned" | "done" | "skipped";
export type DbMealStatus = "planned" | "served";
export type DbTaskStatus = "handled" | "scheduled" | "queued" | "needs_you";
export type DbTaskSource = "seasonal" | "maintenance" | "member" | "provider" | "match";
export type DbUrgency = "whenever" | "this_week" | "soon" | "urgent";
export type DbNeedStatus = "open" | "matching" | "matched" | "scheduled" | "done";
export type DbMatchStatus = "suggested" | "accepted" | "declined";
export type DbLedgerKind = "contribution" | "direct" | "indirect" | "rollover_in" | "membership";

/** Builds Insert and Update from a Row: columns in D are optional on insert (defaults), everything is optional on update. */
type Table<Row, D extends keyof Row = never> = {
  Row: Row;
  Insert: Omit<Row, D> & Partial<Pick<Row, D>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type ProfileRow = { id: Uuid; display_name: string; avatar_url: string; created_at: Timestamp }
export type ColonyRow = {
  id: Uuid; name: string; steward_id: Uuid; invite_code: string; contribution_cents_per_person: number;
  created_at: Timestamp; trial_ends_at: Timestamp; billing_exempt: boolean;
}
export type HouseholdRow = { id: Uuid; colony_id: Uuid; name: string; created_at: Timestamp }
export type ColonyMemberRow = {
  colony_id: Uuid; profile_id: Uuid; role: DbRole; household_id: Uuid | null; contribution_cents: number; joined_at: Timestamp;
}
export type HomeRow = {
  id: Uuid; colony_id: Uuid; household_id: Uuid; label: string; address: string; area: string;
  lat: number; lng: number; plant_count: number; notes: string; created_at: Timestamp;
}
export type ProviderRow = {
  id: Uuid; colony_id: Uuid | null; profile_id: Uuid | null; name: string; avatar_url: string; bio: string; role_line: string;
  area: string; lat: number; lng: number; radius_km: number; rate_cents: number; rate_unit: DbRateUnit; rating: number;
  homes_served: number; kind: DbFund; curated: boolean; brought_by: Uuid | null; created_at: Timestamp;
}
export type ProviderSkillRow = { provider_id: Uuid; skill: DbSkill; is_primary: boolean }
export type ProviderAvailabilityRow = { provider_id: Uuid; weekday: number; from_t: TimeCol; to_t: TimeCol }
export type EngagementRow = {
  id: Uuid; colony_id: Uuid; provider_id: Uuid; skill: DbSkill; cadence: Json; home_ids: Uuid[]; cost_cents: number;
  fund: DbFund; starts_on: DateCol; label: string; duration_min: number; created_at: Timestamp;
}
export type ScheduleItemRow = {
  id: Uuid; colony_id: Uuid; engagement_id: Uuid | null; need_id: Uuid | null; provider_id: Uuid; home_id: Uuid;
  on_date: DateCol; start_t: TimeCol; end_t: TimeCol; kind: DbScheduleKind; title: string; status: DbScheduleStatus; created_at: Timestamp;
}
export type MealRow = {
  id: Uuid; colony_id: Uuid; schedule_item_id: Uuid; on_date: DateCol; title: string; cuisine: string; chef_id: Uuid;
  home_ids: Uuid[]; tags: string[]; status: DbMealStatus;
}
export type NeedRow = {
  id: Uuid; colony_id: Uuid; home_id: Uuid; created_by: Uuid; title: string; note: string; category: DbSkill;
  urgency: DbUrgency; status: DbNeedStatus; created_at: Timestamp;
}
export type MatchRow = {
  id: Uuid; need_id: Uuid; provider_id: Uuid; score: number; reasons: string[]; quote_cents: number; earliest: DateCol;
  status: DbMatchStatus; created_at: Timestamp;
}
export type TaskRow = {
  id: Uuid; colony_id: Uuid; title: string; category: DbSkill; home_id: Uuid | null; status: DbTaskStatus; handled_by: Uuid | null;
  due_on: DateCol; source: DbTaskSource; need_id: Uuid | null; note: string | null; created_at: Timestamp;
}
export type BudgetPeriodRow = {
  id: Uuid; colony_id: Uuid; month: MonthCol; contribution_cents: number; direct_cents: number; leftover_cents: number;
  rollover_in_cents: number; indirect_cents: number; closed_at: DateCol | null;
}
export type LedgerRow = {
  id: Uuid; colony_id: Uuid; month: MonthCol; on_date: DateCol; kind: DbLedgerKind; cents: number; provider_id: Uuid | null;
  profile_id: Uuid | null; note: string; created_at: Timestamp;
}
export type ColonyBillingCustomerRow = {
  profile_id: Uuid; stripe_customer_id: string; email: string | null; livemode: boolean; created_at: Timestamp;
}
export type ColonySubscriptionRow = {
  id: Uuid; stripe_subscription_id: string; colony_id: Uuid; payer_id: Uuid; status: string; stripe_price_id: string | null;
  unit_amount_cents: number | null; current_period_end: Timestamp | null; cancel_at_period_end: boolean; livemode: boolean;
  created_at: Timestamp; updated_at: Timestamp;
}
export type ColonyWebhookEventRow = {
  id: string; type: string; livemode: boolean; received_at: Timestamp; processed_at: Timestamp | null; error: string | null; payload: Json | null;
}

/** What colony_entitlements(cid) returns (null when the caller is not a member). */
export interface ColonyEntitlements {
  id: Uuid;
  name: string;
  steward: boolean;
  exempt: boolean;
  trial_ends_at: Timestamp;
  active: boolean;
  plan: "colony";
  sub: {
    status: string;
    period_end: Timestamp | null;
    cancel_at_period_end: boolean;
    unit_amount_cents: number | null;
    payer: boolean;
  } | null;
  livemode: boolean;
}

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "display_name" | "avatar_url" | "created_at">;
      colonies: Table<ColonyRow, "id" | "contribution_cents_per_person" | "created_at" | "trial_ends_at" | "billing_exempt">;
      households: Table<HouseholdRow, "id" | "created_at">;
      colony_members: Table<ColonyMemberRow, "role" | "household_id" | "contribution_cents" | "joined_at">;
      homes: Table<HomeRow, "id" | "address" | "area" | "lat" | "lng" | "plant_count" | "notes" | "created_at">;
      providers: Table<
        ProviderRow,
        | "id" | "colony_id" | "profile_id" | "avatar_url" | "bio" | "role_line" | "area" | "lat" | "lng" | "radius_km"
        | "rate_cents" | "rate_unit" | "rating" | "homes_served" | "curated" | "brought_by" | "created_at"
      >;
      provider_skills: Table<ProviderSkillRow, "is_primary">;
      provider_availability: Table<ProviderAvailabilityRow>;
      engagements: Table<EngagementRow, "id" | "home_ids" | "cost_cents" | "fund" | "starts_on" | "label" | "duration_min" | "created_at">;
      schedule_items: Table<ScheduleItemRow, "id" | "engagement_id" | "need_id" | "title" | "status" | "created_at">;
      meals: Table<MealRow, "id" | "cuisine" | "home_ids" | "tags" | "status">;
      needs: Table<NeedRow, "id" | "note" | "urgency" | "status" | "created_at">;
      matches: Table<MatchRow, "id" | "score" | "reasons" | "quote_cents" | "status" | "created_at">;
      tasks: Table<TaskRow, "id" | "home_id" | "status" | "handled_by" | "source" | "need_id" | "note" | "created_at">;
      budget_periods: Table<
        BudgetPeriodRow,
        "id" | "contribution_cents" | "direct_cents" | "leftover_cents" | "rollover_in_cents" | "indirect_cents" | "closed_at"
      >;
      ledger: Table<LedgerRow, "id" | "provider_id" | "profile_id" | "note" | "created_at">;
      colony_billing_customers: Table<ColonyBillingCustomerRow, "email" | "livemode" | "created_at">;
      colony_subscriptions: Table<
        ColonySubscriptionRow,
        | "id" | "stripe_price_id" | "unit_amount_cents" | "current_period_end" | "cancel_at_period_end" | "livemode"
        | "created_at" | "updated_at"
      >;
      colony_webhook_events: Table<ColonyWebhookEventRow, "received_at" | "processed_at" | "error" | "payload">;
    };
    Views: { [_ in never]: never };
    Functions: {
      pool_balance: { Args: { cid: Uuid }; Returns: number };
      colony_active: { Args: { cid: Uuid }; Returns: boolean };
      colony_entitlements: { Args: { cid: Uuid }; Returns: Json };
      is_colony_member: { Args: { cid: Uuid; uid?: Uuid }; Returns: boolean };
      is_colony_steward: { Args: { cid: Uuid; uid?: Uuid }; Returns: boolean };
      is_colony_provider: { Args: { cid: Uuid; uid?: Uuid }; Returns: boolean };
      join_colony: { Args: { code: string }; Returns: Uuid };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

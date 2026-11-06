// Seasonal prep across the year, plus preventative maintenance on an interval.
import type { Id, SeasonalTask, Skill } from "@/domain/types";

export const SEASONAL: SeasonalTask[] = [
  // January
  { id: "sea_draft_check", title: "Draft check on doors and windows", skill: "seasonal", months: [1], perHome: true },
  { id: "sea_deep_clean", title: "Deep clean after the holidays", skill: "cleaning", months: [1], catalogId: "cat_deep_clean", perHome: true },
  // February
  { id: "sea_dryer_vent", title: "Dryer vent clean", skill: "handyman", months: [2], catalogId: "cat_dryer_vent", perHome: true },
  // March
  { id: "sea_ac_prep", title: "AC prep and filter order", skill: "hvac", months: [3], perHome: true },
  { id: "sea_screens", title: "Window screens in", skill: "handyman", months: [3], perHome: true },
  { id: "sea_hem_spring", title: "Spring hem and repairs pile", skill: "sewing", months: [3], catalogId: "cat_hem", perHome: false },
  // April
  { id: "sea_repot", title: "Plant repotting and feed", skill: "plants", months: [4], perHome: true },
  { id: "sea_hvac_spring", title: "HVAC tune-up before summer", skill: "hvac", months: [4], catalogId: "cat_hvac_tune", perHome: true },
  // May
  { id: "sea_ac_in", title: "Window AC units in", skill: "handyman", months: [5], catalogId: "cat_ac_swap", perHome: true },
  { id: "sea_grill", title: "Outdoor space and grill ready", skill: "seasonal", months: [5], perHome: false },
  // June
  { id: "sea_ac_filter", title: "AC filter swap", skill: "hvac", months: [6], perHome: true },
  { id: "sea_pest_summer", title: "Summer pest sweep", skill: "pest", months: [6], catalogId: "cat_pest_quarterly", perHome: true },
  // July
  { id: "sea_water_plants", title: "Plant watering plan for travel", skill: "plants", months: [7], perHome: true },
  // August
  { id: "sea_school", title: "Back to school reset", skill: "house_manager", months: [8], perHome: false },
  // September
  { id: "sea_closet_swap", title: "Closet swap, summer out", skill: "house_manager", months: [9], perHome: true },
  { id: "sea_hem_fall", title: "Fall hem and repairs pile", skill: "sewing", months: [9], catalogId: "cat_hem", perHome: false },
  // October
  { id: "sea_leaf_gutter", title: "Leaf sweep and first gutter look", skill: "handyman", months: [10], perHome: true },
  { id: "sea_ac_out", title: "Window AC units out", skill: "handyman", months: [10], catalogId: "cat_ac_swap", perHome: true },
  { id: "sea_hvac_fall", title: "Furnace and heat check", skill: "hvac", months: [10], catalogId: "cat_hvac_tune", perHome: true },
  // November
  { id: "sea_gutters", title: "Gutter clean", skill: "handyman", months: [11], catalogId: "cat_gutters", perHome: true },
  { id: "sea_furnace_filter", title: "Furnace filter swap", skill: "hvac", months: [11], perHome: true },
  { id: "sea_weatherstrip", title: "Weatherstrip doors and windows", skill: "seasonal", months: [11], catalogId: "cat_weatherstrip", perHome: true },
  { id: "sea_hose_bibs", title: "Shut off and drain hose bibs", skill: "plumbing", months: [11], perHome: true },
  // December
  { id: "sea_holiday_prep", title: "Holiday prep, guests and pantry", skill: "house_manager", months: [12], perHome: false },
  { id: "sea_radiator", title: "Radiator bleed and check", skill: "hvac", months: [12], catalogId: "cat_radiator", perHome: true },
];

export interface MaintenanceInterval {
  id: Id;
  title: string;
  skill: Skill;
  everyMonths: number;
  startMonth: number; // 1..12, an anchor month the interval counts from
  catalogId?: Id;
  perHome: boolean;
}

export const MAINTENANCE: MaintenanceInterval[] = [
  { id: "mnt_smoke", title: "Smoke and CO detector test", skill: "handyman", everyMonths: 6, startMonth: 3, perHome: true },
  { id: "mnt_pest", title: "Quarterly pest check", skill: "pest", everyMonths: 3, startMonth: 1, catalogId: "cat_pest_quarterly", perHome: true },
  { id: "mnt_drains", title: "Drain flush and trap check", skill: "plumbing", everyMonths: 4, startMonth: 2, perHome: true },
  { id: "mnt_water_heater", title: "Water heater flush", skill: "plumbing", everyMonths: 12, startMonth: 8, perHome: true },
  { id: "mnt_range_hood", title: "Range hood filter soak", skill: "cleaning", everyMonths: 2, startMonth: 1, perHome: true },
];

export function maintenanceDue(interval: MaintenanceInterval, monthNumber: number): boolean {
  const diff = (((monthNumber - interval.startMonth) % interval.everyMonths) + interval.everyMonths) % interval.everyMonths;
  return diff === 0;
}

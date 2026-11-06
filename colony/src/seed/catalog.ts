// What the indirect pool can fund: typical jobs, typical hours, typical cost.
import type { CatalogItem } from "@/domain/types";

export const CATALOG: CatalogItem[] = [
  { id: "cat_gutters", title: "Gutter clean", skill: "handyman", estCents: 22000, typicalHours: 3, cadenceHint: "Every fall", season: [10, 11] },
  { id: "cat_dryer_vent", title: "Dryer vent clean", skill: "handyman", estCents: 14000, typicalHours: 1.5, cadenceHint: "Once a year", season: [2] },
  { id: "cat_hvac_tune", title: "HVAC tune-up", skill: "hvac", estCents: 19000, typicalHours: 2, cadenceHint: "Twice a year", season: [4, 10] },
  { id: "cat_pest_quarterly", title: "Quarterly pest visit", skill: "pest", estCents: 16000, typicalHours: 1, cadenceHint: "Every three months", season: [1, 4, 7, 10] },
  { id: "cat_grout", title: "Grout and caulk refresh", skill: "handyman", estCents: 26000, typicalHours: 3, cadenceHint: "Every couple of years" },
  { id: "cat_hem", title: "Hem and repairs", skill: "sewing", estCents: 6000, typicalHours: 1.5, cadenceHint: "When the pile grows", season: [3, 9] },
  { id: "cat_weatherstrip", title: "Weatherstripping", skill: "seasonal", estCents: 18000, typicalHours: 2, cadenceHint: "Every fall", season: [11] },
  { id: "cat_radiator", title: "Radiator bleed and check", skill: "hvac", estCents: 12000, typicalHours: 1.5, cadenceHint: "Every fall", season: [11, 12] },
  { id: "cat_ac_swap", title: "AC install or removal", skill: "handyman", estCents: 15000, typicalHours: 2, cadenceHint: "Spring and fall", season: [5, 10] },
  { id: "cat_faucet", title: "Faucet and drain service", skill: "plumbing", estCents: 18000, typicalHours: 1.5, cadenceHint: "When it drips" },
  { id: "cat_fixture", title: "Light fixture swap", skill: "electrical", estCents: 16000, typicalHours: 1.5, cadenceHint: "When you find the right one" },
  { id: "cat_deep_clean", title: "Deep clean after guests", skill: "cleaning", estCents: 22000, typicalHours: 5, cadenceHint: "After the holidays", season: [1] },
];

export function catalogById(id: string): CatalogItem | undefined {
  return CATALOG.find((c) => c.id === id);
}

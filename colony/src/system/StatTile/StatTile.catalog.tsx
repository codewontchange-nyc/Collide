import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { fmt } from "@/domain/money";
import { Figure } from "@/system/Figure/Figure";
import { StatTile } from "./StatTile";

export const entries: CatalogEntry[] = [
  {
    id: "stat-tile",
    name: "StatTile",
    group: "Data",
    tasks: ["the one hero number", "show how much is handled", "show the budget", "show earnings"],
    variants: ["label and value", "unit", "figure countUp", "no label", "boxed (library only)"],
    render: () => (
      <>
        <Specimen label="label and value">
          <dl>
            <StatTile label="Handled this week" value="12" />
          </dl>
        </Specimen>
        <Specimen label="unit">
          <dl>
            <StatTile label="Budget" value={fmt(400000)} unit="a month" />
          </dl>
        </Specimen>
        <Specimen label="figure countUp">
          <dl>
            <StatTile label="Earned" value={<Figure size="lg" value={127400} format={fmt} countUp />} unit="this month" />
          </dl>
        </Specimen>
        <Specimen label="no label">
          <dl>
            <StatTile value="28" unit="dinners" />
          </dl>
        </Specimen>
        <Specimen label="boxed (library only)">
          <dl style={{ width: "100%" }}>
            <StatTile className="ig-stat-tile--boxed" label="Pool" value={fmt(92000)} />
          </dl>
        </Specimen>
      </>
    ),
  },
];

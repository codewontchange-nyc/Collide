import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { fmt } from "@/domain/money";
import { Figure } from "@/system/Figure/Figure";
import { MetricStrip } from "./MetricStrip";

export const entries: CatalogEntry[] = [
  {
    id: "metric-strip",
    name: "MetricStrip",
    group: "Data",
    tasks: ["the figures under a title", "handled and dinners", "spent and pool", "earnings this month", "two numbers side by side"],
    variants: ["strip", "columns 2", "columns 1", "delta up", "delta down", "delta flat", "note", "unit", "odd count", "tiles"],
    render: () => (
      <>
        <Specimen label="strip">
          <div style={{ width: "100%" }}>
            <MetricStrip
              items={[
                { label: "Handled", value: <Figure size="md" value={12} /> },
                { label: "Dinners", value: <Figure size="md" value={4} />, note: "of 28 this month" },
              ]}
            />
          </div>
        </Specimen>
        <Specimen label="columns 2">
          <div style={{ width: "100%" }}>
            <MetricStrip
              columns={2}
              items={[
                { label: "Spent", value: <Figure size="md" value={184050} format={fmt} /> },
                { label: "Pool", value: <Figure size="md" value={92000} format={fmt} /> },
              ]}
            />
          </div>
        </Specimen>
        <Specimen label="columns 1">
          <div style={{ width: "100%" }}>
            <MetricStrip columns={1} items={[{ label: "Earned", value: <Figure size="md" value={127400} format={fmt} countUp />, unit: "this month" }]} />
          </div>
        </Specimen>
        <Specimen label="delta up, down, flat">
          <div style={{ width: "100%" }}>
            <MetricStrip
              columns={1}
              items={[
                { label: "Earned", value: <Figure size="md" value={127400} format={fmt} />, delta: { text: "$240 on last month", direction: "up" } },
                { label: "Spent", value: <Figure size="md" value={184050} format={fmt} />, delta: { text: "$120 on last month", direction: "down" } },
                { label: "Pool", value: <Figure size="md" value={92000} format={fmt} />, delta: { text: "Same as last month", direction: "flat" } },
              ]}
            />
          </div>
        </Specimen>
        <Specimen label="note and unit">
          <div style={{ width: "100%" }}>
            <MetricStrip columns={2} items={[{ label: "Budget", value: <Figure size="md" value={400000} format={fmt} />, unit: "a month", note: "Renews Dec 1" }]} />
          </div>
        </Specimen>
        <Specimen label="odd count">
          <div style={{ width: "100%" }}>
            <MetricStrip
              columns={2}
              items={[
                { label: "Visits", value: <Figure size="md" value={9} /> },
                { label: "Hours", value: <Figure size="md" value={31} /> },
                { label: "Households", value: <Figure size="md" value={5} /> },
              ]}
            />
          </div>
        </Specimen>
        <Specimen label="tiles">
          <div style={{ width: "100%" }}>
            <MetricStrip
              variant="tiles"
              columns={2}
              items={[
                { label: "Handled", value: <Figure size="md" value={12} /> },
                { label: "Open", value: <Figure size="md" value={2} /> },
              ]}
            />
          </div>
        </Specimen>
      </>
    ),
  },
];

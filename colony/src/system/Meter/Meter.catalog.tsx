import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { Meter } from "./Meter";

export const entries: CatalogEntry[] = [
  {
    id: "meter",
    name: "Meter",
    group: "Data",
    tasks: ["show a split", "direct and pool", "rank the weeks", "show how much of a budget is used"],
    variants: ["two series with legend", "one series", "max (ranked bar)", "highlight", "highlight false", "legend off", "empty"],
    render: () => (
      <>
        <Specimen label="two series with legend">
          <div style={{ width: "100%" }}>
            <Meter
              label="Spend split: 62 percent direct, 38 percent pool"
              parts={[
                { key: "direct", value: 352000, label: "Direct $3,520" },
                { key: "pool", value: 216000, label: "Pool $2,160" },
              ]}
            />
          </div>
        </Specimen>
        <Specimen label="one series">
          <div style={{ width: "100%" }}>
            <Meter label="Budget used: 46 percent" parts={[{ key: "one", value: 46 }]} max={100} />
          </div>
        </Specimen>
        <Specimen label="max (ranked bar)">
          <div style={{ width: "100%" }}>
            <Meter label="Nov 2 to 8: $1,760 of $2,400" parts={[{ key: "one", value: 176000 }]} max={240000} />
          </div>
        </Specimen>
        <Specimen label="highlight">
          <div style={{ width: "100%" }}>
            <Meter label="Nov 9 to 15: $2,400 of $2,400, the top week" parts={[{ key: "one", value: 240000 }]} max={240000} highlight />
          </div>
        </Specimen>
        <Specimen label="highlight false">
          <div style={{ width: "100%" }}>
            <Meter label="Nov 16 to 22: $980 of $2,400" parts={[{ key: "one", value: 98000 }]} max={240000} highlight={false} />
          </div>
        </Specimen>
        <Specimen label="legend off">
          <div style={{ width: "100%" }}>
            <Meter
              label="Spend split: 62 percent direct, 38 percent pool"
              legend={false}
              parts={[
                { key: "direct", value: 62, label: "Direct" },
                { key: "pool", value: 38, label: "Pool" },
              ]}
            />
          </div>
        </Specimen>
        <Specimen label="empty">
          <div style={{ width: "100%" }}>
            <Meter label="Nothing spent yet" parts={[{ key: "direct", value: 0, label: "Direct -" }]} max={100} />
          </div>
        </Specimen>
      </>
    ),
  },
];

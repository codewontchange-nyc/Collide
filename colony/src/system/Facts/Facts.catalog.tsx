import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { fmt } from "@/domain/money";
import { Figure } from "@/system/Figure/Figure";
import { StatusWord } from "@/system/SignalDot/SignalDot";
import { Facts } from "./Facts";

const full = { width: "100%" } as const;

export const entries: CatalogEntry[] = [
  {
    id: "facts",
    name: "Facts",
    group: "Text and heads",
    tasks: ["the next charge", "where and when a visit is", "a home and its engagement", "label over value"],
    variants: ["two columns", "columns 1", "meta", "figure value", "status value", "falsy items skipped", "long value wraps"],
    render: () => (
      <>
        <Specimen label="two columns">
          <div style={full}>
            <Facts
              items={[
                { label: "Next", value: "Dec 1" },
                { label: "Amount", value: "$149" },
              ]}
            />
          </div>
        </Specimen>
        <Specimen label="columns 1">
          <div style={full}>
            <Facts
              columns={1}
              items={[
                { label: "Home", value: "12 Dekalb Ave, Brooklyn" },
                { label: "Engagement", value: "Plumbing, every other week" },
              ]}
            />
          </div>
        </Specimen>
        <Specimen label="meta">
          <div style={full}>
            <Facts
              items={[
                { label: "Next charge", value: "$149", meta: "Dec 1" },
                { label: "Card", value: "Visa 4242", meta: "Expires 09/28" },
              ]}
            />
          </div>
        </Specimen>
        <Specimen label="figure value, status value">
          <div style={full}>
            <Facts
              items={[
                { label: "Pool", value: <Figure size="sm" value={92000} format={fmt} /> },
                { label: "Membership", value: <StatusWord state="success">Active</StatusWord> },
              ]}
            />
          </div>
        </Specimen>
        <Specimen label="falsy items skipped">
          <div style={full}>
            <Facts items={[{ label: "Shown", value: "Yes" }, false, undefined, { label: "Also shown", value: "Yes" }]} />
          </div>
        </Specimen>
        <Specimen label="long value wraps">
          <div style={full}>
            <Facts
              items={[
                { label: "Address", value: "Apartment 4R, 1270 Dekalb Avenue, Brooklyn, New York 11221" },
                { label: "Note", value: "Ring twice; the bell on the left is the Nguyens." },
              ]}
            />
          </div>
        </Specimen>
      </>
    ),
  },
];

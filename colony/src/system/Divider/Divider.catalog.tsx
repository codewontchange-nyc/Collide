import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { Divider } from "./Divider";

export const entries: CatalogEntry[] = [
  {
    id: "divider",
    name: "Divider",
    group: "Text and heads",
    tasks: ["separate two blocks", "rule under a head", "a ledger line above a sum"],
    variants: ["hairline", "ink", "in a grid"],
    render: () => (
      <>
        <Specimen label="hairline">
          <Divider />
        </Specimen>
        <Specimen label="ink">
          <Divider rule="ink" />
        </Specimen>
        <Specimen label="in a grid">
          <div style={{ display: "grid", gap: "var(--padding-med)", width: "100%" }}>
            <p className="paragraph-x-small secondary">Eight dinners served.</p>
            <Divider />
            <p className="paragraph-x-small secondary">Four visits booked.</p>
            <Divider rule="ink" />
            <p className="headline-small">Twelve things handled.</p>
          </div>
        </Specimen>
      </>
    ),
  },
];

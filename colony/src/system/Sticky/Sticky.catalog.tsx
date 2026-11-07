import { useState } from "react";
import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { List, ListRow } from "@/system/List/List";
import { SearchField } from "@/system/SearchField/SearchField";
import { Sticky } from "./Sticky";

/** A scrolling stage so the sticky row has something to stick over. */
function StickyStage() {
  const [q, setQ] = useState("");
  const rows = Array.from({ length: 12 }, (_, i) => `Row ${String(i + 1).padStart(2, "0")}`).filter((r) => r.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="ig-main" style={{ height: "240px", width: "100%" }}>
      <div style={{ display: "grid", gap: "var(--padding-med)", padding: "var(--padding-med) 0" }}>
        <Sticky>
          <SearchField value={q} onChange={setQ} onClear={() => setQ("")} label="Search rows" placeholder="Search rows" />
        </Sticky>
        <List rule="none">
          {rows.map((r) => (
            <ListRow key={r} title={r} facts="Scroll to see the fade under the row." />
          ))}
        </List>
      </div>
    </div>
  );
}

export const entries: CatalogEntry[] = [
  {
    id: "sticky",
    name: "Sticky",
    group: "Shell",
    tasks: ["keep the search in reach", "the one sticky row"],
    variants: ["sticky search over a list (scroll the stage)"],
    render: () => (
      <>
        <Specimen label="sticky search over a list (scroll the stage)">
          <StickyStage />
        </Specimen>
      </>
    ),
  },
];

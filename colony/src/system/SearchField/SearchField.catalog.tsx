import { useState } from "react";
import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { SearchField } from "./SearchField";

const full = { width: "100%" } as const;

/* The pill fills its column (the kit's SearchField stretches in its toolbar); the stage is 309px at 375, so the catalog's placeholder is the short form. */
function Live({ initial = "", placeholder = "Search by name or task" }: { initial?: string; placeholder?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <div style={full}>
      <SearchField label="Search components" placeholder={placeholder} value={value} onChange={setValue} />
    </div>
  );
}

function LiveClear() {
  const [value, setValue] = useState("notice");
  const [cleared, setCleared] = useState(0);
  return (
    <div style={{ display: "grid", gap: "var(--padding-small)", width: "100%" }}>
      <SearchField label="Search components" value={value} onChange={setValue} clearLabel="Clear the search" onClear={() => { setValue(""); setCleared((n) => n + 1); }} />
      <span className="label-small meta">{cleared === 0 ? "onClear not fired yet" : `onClear fired ${cleared}`}</span>
    </div>
  );
}

export const entries: CatalogEntry[] = [
  {
    id: "search-field",
    name: "SearchField",
    group: "Forms",
    tasks: ["search", "find a component", "filter a long list by typing", "clear a search", "clearLabel: the clear button's accessible name (default Clear)"],
    variants: ["empty", "placeholder", "filled (clear button)", "onClear", "autoFocus"],
    render: () => (
      <>
        <Specimen label="empty">
          <Live placeholder="" />
        </Specimen>
        <Specimen label="placeholder">
          <Live />
        </Specimen>
        <Specimen label="filled (clear button)">
          <Live initial="switch" />
        </Specimen>
        <Specimen label="onClear">
          <LiveClear />
        </Specimen>
        <Specimen label="autoFocus (shown without focus)">
          <Live />
        </Specimen>
      </>
    ),
  },
];

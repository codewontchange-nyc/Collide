import { useState } from "react";
import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { Checkbox } from "./Checkbox";

function Live({ label, hint, initial = false, disabled }: { label: string; hint?: string; initial?: boolean; disabled?: boolean }) {
  const [checked, setChecked] = useState(initial);
  return <Checkbox label={label} hint={hint} checked={checked} onChange={setChecked} disabled={disabled} />;
}

/* A parent over two children: the parent shows the dash while the children disagree. */
function LiveGroup() {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  const all = a && b;
  const some = a !== b;
  return (
    <div style={{ display: "grid", width: "100%" }}>
      <Checkbox
        label="Compare to last month"
        checked={all}
        indeterminate={some}
        onChange={(next) => {
          setA(next);
          setB(next);
        }}
      />
      <div style={{ paddingLeft: "var(--padding-large)" }}>
        <Checkbox label="Dinners" checked={a} onChange={setA} />
        <Checkbox label="Visits" checked={b} onChange={setB} />
      </div>
    </div>
  );
}

export const entries: CatalogEntry[] = [
  {
    id: "checkbox",
    name: "Checkbox",
    group: "Forms",
    tasks: ["agree to something", "pick several of a list", "compare to a period", "a setting on You"],
    variants: ["unchecked", "checked", "indeterminate (live group)", "hint", "disabled unchecked", "disabled checked"],
    render: () => (
      <>
        <Specimen label="unchecked">
          <Live label="Email me the week ahead" />
        </Specimen>
        <Specimen label="checked">
          <Live label="Email me the week ahead" initial />
        </Specimen>
        <Specimen label="indeterminate (live group)">
          <LiveGroup />
        </Specimen>
        <Specimen label="hint">
          <Live label="Open to new neighbors" hint="People two blocks over can see your colony" initial />
        </Specimen>
        <Specimen label="disabled, unchecked">
          <Live label="Billing by card" disabled />
        </Specimen>
        <Specimen label="disabled, checked">
          <Live label="Trial" disabled initial />
        </Specimen>
      </>
    ),
  },
];

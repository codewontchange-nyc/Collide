import { useState } from "react";
import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { Switch } from "./Switch";

function Live({ label, hint, initial = false, disabled, hideLabel }: { label: string; hint?: string; initial?: boolean; disabled?: boolean; hideLabel?: boolean }) {
  const [checked, setChecked] = useState(initial);
  return <Switch label={label} hint={hint} checked={checked} onChange={setChecked} disabled={disabled} hideLabel={hideLabel} />;
}

export const entries: CatalogEntry[] = [
  {
    id: "switch",
    name: "Switch",
    group: "Forms",
    tasks: ["turn something on or off", "availability for a day", "dark mode in the library", "a setting on You"],
    variants: ["off", "on", "hint", "disabled off", "disabled on", "hideLabel"],
    render: () => (
      <>
        <Specimen label="off">
          <Live label="Weekly dinner" />
        </Specimen>
        <Specimen label="on">
          <Live label="Weekly dinner" initial />
        </Specimen>
        <Specimen label="hint">
          <Live label="Smart matched" hint="Colony picks who comes when you do not" initial />
        </Specimen>
        <Specimen label="disabled, off">
          <Live label="Time travel" disabled />
        </Specimen>
        <Specimen label="disabled, on">
          <Live label="Trial" disabled initial />
        </Specimen>
        <Specimen label="hideLabel">
          <Live label="Dark" hideLabel />
        </Specimen>
      </>
    ),
  },
];

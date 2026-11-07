import { useState } from "react";
import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { TextField } from "./TextField";

function Live({ label, hint, placeholder, initial = "" }: { label: string; hint?: string; placeholder?: string; initial?: string }) {
  const [value, setValue] = useState(initial);
  return <TextField label={label} hint={hint} placeholder={placeholder} value={value} onChange={setValue} />;
}

export const entries: CatalogEntry[] = [
  {
    id: "text-field",
    name: "TextField",
    group: "Forms",
    tasks: ["type a value", "name something", "enter an address", "write a note", "fill a form in a sheet"],
    variants: ["empty", "placeholder", "filled", "hint", "error", "disabled", "readOnly", "prefix", "suffix", "textarea", "required"],
    render: () => (
      <>
        <Specimen label="empty">
          <Live label="Colony name" />
        </Specimen>
        <Specimen label="placeholder">
          <Live label="Street" placeholder="Street, like Dekalb Ave" />
        </Specimen>
        <Specimen label="filled">
          <Live label="Colony name" initial="Myrtle & Vanderbilt" />
        </Specimen>
        <Specimen label="hint">
          <Live label="Cross streets" hint="Two streets, so neighbors can find you" placeholder="Dekalb & Bergen" />
        </Specimen>
        <Specimen label="error">
          <TextField label="Invite code" value="COL-11" onChange={() => undefined} error="That code is not one of ours" />
        </Specimen>
        <Specimen label="disabled">
          <TextField label="Member since" value="June 2026" onChange={() => undefined} disabled />
        </Specimen>
        <Specimen label="readOnly">
          <TextField label="Plan" value="Household, monthly" onChange={() => undefined} readOnly hint="Change it from Membership" />
        </Specimen>
        <Specimen label="prefix">
          <TextField label="Monthly budget" prefix="$" inputMode="decimal" defaultValue="4,000" />
        </Specimen>
        <Specimen label="suffix">
          <TextField label="Visit length" suffix="MIN" inputMode="numeric" defaultValue="90" />
        </Specimen>
        <Specimen label="textarea">
          <TextField label="Anything the provider should know" rows={3} placeholder="The gate code, the dog, the back door" />
        </Specimen>
        <Specimen label="required">
          <TextField label="Your name" required placeholder="You, or the first person" />
        </Specimen>
      </>
    ),
  },
];

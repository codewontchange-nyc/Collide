import { useState } from "react";
import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { SelectField } from "./SelectField";

type Day = "mon" | "tue" | "wed" | "thu" | "fri";
const DAYS: { value: Day; label: string; disabled?: boolean }[] = [
  { value: "mon", label: "Monday" },
  { value: "tue", label: "Tuesday" },
  { value: "wed", label: "Wednesday" },
  { value: "thu", label: "Thursday", disabled: true },
  { value: "fri", label: "Friday" },
];

type Slot = "morning" | "afternoon" | "evening" | "off";
const SLOTS: { value: Slot; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "off", label: "Off" },
];

function Live(props: { hint?: string; error?: string; disabled?: boolean; hideLabel?: boolean; overlay?: boolean; initial?: Day }) {
  const [value, setValue] = useState<Day>(props.initial ?? "tue");
  return <SelectField<Day> label="Weekly dinner" options={DAYS} value={value} onChange={setValue} {...props} />;
}

function LiveOverlay() {
  const [value, setValue] = useState<Slot>("morning");
  return <SelectField<Slot> label="Tuesday" options={SLOTS} value={value} onChange={setValue} overlay />;
}

export const entries: CatalogEntry[] = [
  {
    id: "select-field",
    name: "SelectField",
    group: "Forms",
    tasks: ["pick one of a few options", "choose a day", "set availability for a day", "open the OS picker"],
    variants: ["default", "hint", "error", "disabled", "disabled option", "hideLabel", "overlay"],
    render: () => (
      <>
        <Specimen label="default">
          <Live />
        </Specimen>
        <Specimen label="hint">
          <Live hint="The colony eats together once a week" />
        </Specimen>
        <Specimen label="error">
          <Live initial="fri" error="Friday is already taken" />
        </Specimen>
        <Specimen label="disabled">
          <Live disabled />
        </Specimen>
        <Specimen label="disabled option">
          <Live hint="Thursday is greyed out in the list" />
        </Specimen>
        <Specimen label="hideLabel">
          <Live hideLabel />
        </Specimen>
        <Specimen label="overlay">
          <LiveOverlay />
        </Specimen>
      </>
    ),
  },
];

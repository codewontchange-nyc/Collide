import { useState } from "react";
import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { fmt } from "@/domain/money";
import { NumberStepper } from "./NumberStepper";

function Live({ initial, step, min, max, format, label = "Count" }: { initial: number; step?: number; min?: number; max?: number; format?: (v: number) => string; label?: string }) {
  const [value, setValue] = useState(initial);
  return <NumberStepper label={label} value={value} onChange={setValue} step={step} min={min} max={max} format={format} />;
}

export const entries: CatalogEntry[] = [
  {
    id: "number-stepper",
    name: "NumberStepper",
    group: "Forms",
    tasks: ["set a budget", "count people", "choose how many", "nudge a number up or down"],
    variants: ["default", "step and bounds", "at min (less disabled)", "at max (more disabled)", "format (money)", "custom labels"],
    render: () => (
      <>
        <Specimen label="default">
          <Live initial={2} label="People" />
        </Specimen>
        <Specimen label="step and bounds">
          <Live initial={4} step={2} min={0} max={12} label="Dinners a month" />
        </Specimen>
        <Specimen label="at min (less disabled)">
          <Live initial={0} min={0} max={5} label="Guests" />
        </Specimen>
        <Specimen label="at max (more disabled)">
          <Live initial={5} min={0} max={5} label="Guests" />
        </Specimen>
        <Specimen label="format (money)">
          <Live initial={400000} step={25000} min={100000} max={1000000} format={fmt} label="Monthly budget" />
        </Specimen>
        <Specimen label="custom labels">
          <NumberStepperLabels />
        </Specimen>
      </>
    ),
  },
];

function NumberStepperLabels() {
  const [value, setValue] = useState(1);
  return <NumberStepper label="Visits a week" value={value} onChange={setValue} min={1} max={7} decrementLabel="One visit fewer" incrementLabel="One visit more" />;
}

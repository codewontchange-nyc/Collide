import { useState } from "react";
import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { Button } from "@/system/Button/Button";
import { Steps } from "./Steps";

function LiveTrack() {
  const [current, setCurrent] = useState(2);
  return (
    <div style={{ display: "grid", gap: "var(--padding-med)", width: "100%" }}>
      <Steps count={4} current={current} />
      <div style={{ display: "flex", gap: "var(--padding-small)" }}>
        <Button variant="grey" hideIcon disabled={current <= 1} onClick={() => setCurrent((c) => Math.max(1, c - 1))}>
          Back
        </Button>
        <Button hideIcon disabled={current >= 4} onClick={() => setCurrent((c) => Math.min(4, c + 1))}>
          Continue
        </Button>
      </div>
    </div>
  );
}

export const entries: CatalogEntry[] = [
  {
    id: "steps",
    name: "Steps",
    group: "Forms",
    tasks: ["show progress through a wizard", "step 2 of 4", "the Start wizard's progress"],
    variants: ["track (live)", "track step 1 of 4", "track step 4 of 4", "dots step 1 of 4", "dots step 2 of 4", "dots step 4 of 4", "custom label"],
    render: () => (
      <>
        <Specimen label="track (live)">
          <LiveTrack />
        </Specimen>
        <Specimen label="track, step 1 of 4">
          <Steps count={4} current={1} />
        </Specimen>
        <Specimen label="track, step 4 of 4">
          <Steps count={4} current={4} />
        </Specimen>
        <Specimen label="dots, step 1 of 4">
          <Steps variant="dots" count={4} current={1} />
        </Specimen>
        <Specimen label="dots, step 2 of 4">
          <Steps variant="dots" count={4} current={2} />
        </Specimen>
        <Specimen label="dots, step 4 of 4">
          <Steps variant="dots" count={4} current={4} />
        </Specimen>
        <Specimen label="custom label">
          <Steps count={3} current={2} label={(c, n) => `Part ${c} of ${n}`} />
        </Specimen>
      </>
    ),
  },
];

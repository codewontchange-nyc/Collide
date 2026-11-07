import { useState } from "react";
import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { QuietButton } from "@/system/QuietButton/QuietButton";
import { Mark } from "./Mark";

/** Remounts the mark so the draw in can be replayed. */
function Replay({ size }: { size: "md" | "lg" }) {
  const [gen, setGen] = useState(0);
  return (
    <>
      <Mark key={gen} size={size} drawIn />
      <QuietButton onClick={() => setGen((g) => g + 1)}>Draw again</QuietButton>
    </>
  );
}

export const entries: CatalogEntry[] = [
  {
    id: "mark",
    name: "Mark",
    group: "Shell",
    tasks: ["the logomark", "the boot screen", "the welcome masthead", "the favicon's geometry"],
    variants: ["sm", "md", "lg", "drawIn md", "drawIn lg", "wordmark md", "wordmark lg", "label", "on ink"],
    render: () => (
      <>
        <Specimen label="sm">
          <Mark size="sm" />
        </Specimen>
        <Specimen label="md">
          <Mark size="md" />
        </Specimen>
        <Specimen label="lg">
          <Mark size="lg" />
        </Specimen>
        <Specimen label="drawIn md">
          <Replay size="md" />
        </Specimen>
        <Specimen label="drawIn lg">
          <Replay size="lg" />
        </Specimen>
        <Specimen label="wordmark md">
          <Mark size="md" wordmark />
        </Specimen>
        <Specimen label="wordmark lg">
          <Mark size="lg" wordmark />
        </Specimen>
        <Specimen label="label">
          <Mark size="md" label="Colony, Dekalb and Bergen" />
        </Specimen>
        <Specimen label="on ink" ground="inverted">
          <Mark size="md" />
        </Specimen>
      </>
    ),
  },
];

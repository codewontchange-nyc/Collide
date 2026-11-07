import { useState } from "react";
import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { fmt } from "@/domain/money";
import { Button } from "@/system/Button/Button";
import { AmbientIcon, DotGrid, Jar, type PatternName } from "./DotGrid";

const PATTERN_NAMES: PatternName[] = ["full", "plus", "cross", "ring", "center", "rise", "forward", "colony"];

function Replay({ children, label }: { children: (key: number) => React.ReactNode; label: string }) {
  const [key, setKey] = useState(0);
  return (
    <Specimen label={label}>
      {children(key)}
      <Button variant="grey" hideIcon onClick={() => setKey((k) => k + 1)}>
        Replay
      </Button>
    </Specimen>
  );
}

function JarDemo() {
  const max = 400000;
  const [cents, setCents] = useState(240000);
  const percent = Math.round((cents / max) * 100);
  const label = `Pool at ${percent} percent of ${fmt(max)}`;
  return (
    <>
      <Specimen label="md, live">
        <Jar cents={cents} maxCents={max} size="md" label={label} />
      </Specimen>
      <Specimen label="lg, live">
        <Jar cents={cents} maxCents={max} size="lg" label={label} />
        <span className="label-small meta">{fmt(cents)}</span>
      </Specimen>
      <Specimen label="change the pool">
        <Button variant="grey" hideIcon onClick={() => setCents((c) => Math.min(max, c + 32000))}>
          Add {fmt(32000)}
        </Button>
        <Button variant="grey" hideIcon onClick={() => setCents((c) => Math.max(0, c - 32000))}>
          Spend {fmt(32000)}
        </Button>
      </Specimen>
      <Specimen label="empty">
        <Jar cents={0} maxCents={max} size="md" label={`Pool at 0 percent of ${fmt(max)}`} />
      </Specimen>
      <Specimen label="full">
        <Jar cents={max} maxCents={max} size="md" label={`Pool at 100 percent of ${fmt(max)}`} />
      </Specimen>
      <Specimen label="animate false">
        <Jar cents={cents} maxCents={max} size="md" animate={false} label={label} />
      </Specimen>
    </>
  );
}

export const entries: CatalogEntry[] = [
  {
    id: "dotgrid",
    name: "DotGrid",
    group: "Marks and status",
    tasks: ["mark a tab", "draw the companion", "draw the mark", "show a lit set", "ambient icon", "style: inline custom properties only (--ig-settle-step for a slower or faster settle)"],
    variants: [
      ...PATTERN_NAMES.map((p) => `sm ${p}`),
      ...PATTERN_NAMES.map((p) => `md ${p}`),
      ...PATTERN_NAMES.map((p) => `lg ${p}`),
      "lit count",
      "lit array",
      "unlit faint",
      "unlit surface",
      "unlit dim",
      "unlit none",
      "settle center",
      "settle reading",
      "settle clockwise",
      "ambient",
      "label",
    ],
    render: () => (
      <>
        {PATTERN_NAMES.map((p) => (
          <Specimen key={`sm-${p}`} label={`sm ${p}`}>
            <AmbientIcon pattern={p} />
          </Specimen>
        ))}
        {PATTERN_NAMES.map((p) => (
          <Specimen key={`md-${p}`} label={`md ${p}`}>
            <DotGrid size="md" pattern={p} />
          </Specimen>
        ))}
        {PATTERN_NAMES.map((p) => (
          <Specimen key={`lg-${p}`} label={`lg ${p}`}>
            <DotGrid size="lg" pattern={p} />
          </Specimen>
        ))}
        <Specimen label="lit count, 11 of 25">
          <DotGrid size="md" lit={11} />
        </Specimen>
        <Specimen label="lit array">
          <DotGrid size="md" lit={[7, 11, 12, 13, 17].reduce((a, i) => ((a[i] = true), a), Array(25).fill(false) as boolean[])} />
        </Specimen>
        <Specimen label="unlit faint">
          <DotGrid size="md" pattern="plus" unlit="faint" />
        </Specimen>
        <Specimen label="unlit surface">
          <DotGrid size="md" pattern="plus" unlit="surface" />
        </Specimen>
        <Specimen label="unlit dim" ground="inverted">
          <DotGrid size="md" pattern="plus" unlit="dim" />
        </Specimen>
        <Specimen label="unlit none">
          <DotGrid size="md" pattern="colony" unlit="none" />
        </Specimen>
        <Replay label="settle center">{(k) => <DotGrid key={k} size="md" pattern="full" settle settleOrder="center" />}</Replay>
        <Replay label="settle reading">{(k) => <AmbientIcon key={k} pattern="full" settle settleOrder="reading" />}</Replay>
        <Replay label="settle clockwise">{(k) => <DotGrid key={k} size="md" pattern="colony" unlit="none" settle settleOrder="clockwise" />}</Replay>
        <Specimen label="ambient">
          <DotGrid size="md" lit={[7, 11, 12, 13, 17].reduce((a, i) => ((a[i] = true), a), Array(25).fill(false) as boolean[])} ambient="ring" />
        </Specimen>
        <Specimen label="label">
          <DotGrid size="sm" pattern="colony" label="Colony" />
        </Specimen>
      </>
    ),
  },
  {
    id: "dotgrid-jar",
    name: "Jar",
    group: "Data",
    tasks: ["show the pool", "show how full something is", "a level, not a tally"],
    variants: ["md, live", "lg, live", "change the pool", "empty", "full", "animate false"],
    render: () => <JarDemo />,
  },
];

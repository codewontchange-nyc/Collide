import { useState } from "react";
import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { Tabs, type TabSpec } from "./Tabs";

function Demo({ tabs, label, fill, scroll, panels }: { tabs: TabSpec[]; label: string; fill?: boolean; scroll?: boolean; panels?: string[] }) {
  const [value, setValue] = useState(0);
  const current = tabs[value];
  return (
    <div style={{ display: "grid", gap: "var(--padding-med)", width: "100%", minWidth: 0 }}>
      <Tabs tabs={tabs} value={value} onChange={setValue} label={label} fill={fill} scroll={scroll} />
      {panels && current?.id && (
        <p role="tabpanel" id={`${current.id}-panel`} aria-labelledby={current.id} className="paragraph-x-small secondary">
          {panels[value]}
        </p>
      )}
    </div>
  );
}

const NEEDS: TabSpec[] = [
  { label: "Handled for you", count: 12, id: "needs-handled" },
  { label: "Needs you", count: 2, id: "needs-you" },
];

const RANGES: TabSpec[] = [{ label: "This week" }, { label: "This month" }, { label: "All time" }];

const MANY: TabSpec[] = [
  { label: "Upcoming", count: 6 },
  { label: "Past", count: 28 },
  { label: "Canceled", count: 1 },
  { label: "Recurring", count: 4 },
  { label: "Requests", count: 2 },
  { label: "Archive" },
];

const LONG: TabSpec[] = [{ label: "Everything handled for the household" }, { label: "Things that still need a decision" }, { label: "Later" }];

export const entries: CatalogEntry[] = [
  {
    id: "tabs",
    name: "Tabs",
    group: "Pressables",
    tasks: ["switch between views", "scope a list", "handled for you or needs you", "pick a range of a list"],
    variants: ["fill", "with counts and panels", "three up", "scroll", "long labels (ellipsis)", "keyboard: arrows, Home, End"],
    render: () => (
      <>
        <Specimen label="fill">
          <Demo tabs={RANGES} label="Range" />
        </Specimen>
        <Specimen label="with counts and panels">
          <Demo tabs={NEEDS} label="Needs" panels={["Twelve things Colony handled this week.", "Two things are waiting on you."]} />
        </Specimen>
        <Specimen label="three up">
          <Demo tabs={RANGES} label="Range, three up" />
        </Specimen>
        <Specimen label="scroll">
          <Demo tabs={MANY} label="Visits" scroll />
        </Specimen>
        <Specimen label="long labels (ellipsis)">
          <Demo tabs={LONG} label="Long labels" />
        </Specimen>
        <Specimen label="keyboard: arrows, Home, End">
          <Demo tabs={RANGES} label="Keyboard" />
        </Specimen>
      </>
    ),
  },
];

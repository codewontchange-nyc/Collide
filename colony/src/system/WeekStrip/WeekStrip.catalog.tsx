import { useState } from "react";
import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { WeekStrip, type WeekDay } from "./WeekStrip";

const WEEK: WeekDay[] = [
  { date: "2026-11-02", weekday: "Mon", number: 2, relation: "past", busy: true, label: "Monday, Nov 2, one thing" },
  { date: "2026-11-03", weekday: "Tue", number: 3, relation: "past", label: "Tuesday, Nov 3" },
  { date: "2026-11-04", weekday: "Wed", number: 4, relation: "past", busy: true, label: "Wednesday, Nov 4, one thing" },
  { date: "2026-11-05", weekday: "Thu", number: 5, relation: "today", busy: true, label: "Thursday, Nov 5, today, two things" },
  { date: "2026-11-06", weekday: "Fri", number: 6, relation: "future", label: "Friday, Nov 6" },
  { date: "2026-11-07", weekday: "Sat", number: 7, relation: "future", busy: true, label: "Saturday, Nov 7, one thing" },
  { date: "2026-11-08", weekday: "Sun", number: 8, relation: "future", label: "Sunday, Nov 8" },
];

const QUIET: WeekDay[] = WEEK.map((d) => ({ ...d, busy: false }));

function Selectable() {
  const [selected, setSelected] = useState("2026-11-05");
  return <WeekStrip days={WEEK} selected={selected} onSelect={setSelected} label="Pick a day" />;
}

export const entries: CatalogEntry[] = [
  {
    id: "week-strip",
    name: "WeekStrip",
    group: "People and time",
    tasks: ["see the week at a glance", "find today", "see which days hold something", "pick a day"],
    variants: ["static", "quiet week", "onSelect with selected", "aria-label"],
    render: () => (
      <>
        <Specimen label="static">
          <div style={{ width: "100%" }}>
            <WeekStrip days={WEEK} />
          </div>
        </Specimen>
        <Specimen label="quiet week">
          <div style={{ width: "100%" }}>
            <WeekStrip days={QUIET} />
          </div>
        </Specimen>
        <Specimen label="onSelect with selected">
          <div style={{ width: "100%" }}>
            <Selectable />
          </div>
        </Specimen>
        <Specimen label="aria-label">
          <div style={{ width: "100%" }}>
            <WeekStrip days={WEEK} label="The week of Nov 2" />
          </div>
        </Specimen>
      </>
    ),
  },
];

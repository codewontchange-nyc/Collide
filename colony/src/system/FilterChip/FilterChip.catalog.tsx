import { useState } from "react";
import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { ChipRow, FilterChip } from "./FilterChip";

function Toggle({ children, count, initial = false }: { children: string; count?: number; initial?: boolean }) {
  const [pressed, setPressed] = useState(initial);
  return (
    <FilterChip pressed={pressed} onPress={() => setPressed((p) => !p)} count={count}>
      {children}
    </FilterChip>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function WeekRow() {
  const [on, setOn] = useState<Set<string>>(new Set(["Mon", "Wed", "Fri"]));
  return (
    <ChipRow label="Days">
      {DAYS.map((d) => (
        <FilterChip
          key={d}
          pressed={on.has(d)}
          onPress={() =>
            setOn((s) => {
              const next = new Set(s);
              if (next.has(d)) next.delete(d);
              else next.add(d);
              return next;
            })
          }
        >
          {d}
        </FilterChip>
      ))}
    </ChipRow>
  );
}

const SKILLS = [
  ["Plumbing", 4],
  ["Electrical", 2],
  ["Childcare", 7],
  ["Cooking", 3],
  ["Cleaning", 5],
  ["Gardening", 1],
  ["Tutoring", 2],
  ["Moving", 0],
] as const;

function ScrollRow() {
  const [picked, setPicked] = useState<string | null>("Childcare");
  return (
    <ChipRow scroll label="Skills">
      {SKILLS.map(([name, n]) => (
        <FilterChip key={name} pressed={picked === name} onPress={() => setPicked((p) => (p === name ? null : name))} count={n}>
          {name}
        </FilterChip>
      ))}
    </ChipRow>
  );
}

function Suggestions() {
  const [value, setValue] = useState("");
  return (
    <>
      <ChipRow label="Suggestions">
        {["Kitchen faucet drips", "Lawn needs mowing", "Dinner for six"].map((s) => (
          <FilterChip key={s} momentary onPress={() => setValue(s)}>
            {s}
          </FilterChip>
        ))}
      </ChipRow>
      <p className="paragraph-x-small secondary">{value || "Tap a suggestion to fill the field."}</p>
    </>
  );
}

export const entries: CatalogEntry[] = [
  {
    id: "filter-chip",
    name: "FilterChip",
    group: "Pressables",
    tasks: ["filter a list", "pick a day", "pick an urgency", "choose skills in a form", "fill a field from a suggestion"],
    variants: ["default", "pressed", "with count", "pressed with count", "momentary", "disabled", "disabled pressed"],
    render: () => (
      <>
        <Specimen label="default">
          <Toggle>Plumbing</Toggle>
        </Specimen>
        <Specimen label="pressed">
          <Toggle initial>Childcare</Toggle>
        </Specimen>
        <Specimen label="with count">
          <Toggle count={4}>Needs you</Toggle>
        </Specimen>
        <Specimen label="pressed with count">
          <Toggle initial count={12}>
            Handled
          </Toggle>
        </Specimen>
        <Specimen label="momentary">
          <Suggestions />
        </Specimen>
        <Specimen label="disabled">
          <FilterChip disabled onPress={() => undefined}>
            Later
          </FilterChip>
        </Specimen>
        <Specimen label="disabled pressed">
          <FilterChip disabled pressed onPress={() => undefined} count={2}>
            Locked
          </FilterChip>
        </Specimen>
      </>
    ),
  },
  {
    id: "chip-row",
    name: "ChipRow",
    group: "Pressables",
    tasks: ["show every option in a form", "scroll a long optional set", "group chips under a name"],
    variants: ["wrap", "scroll", "labelled group"],
    render: () => (
      <>
        <Specimen label="wrap">
          <WeekRow />
        </Specimen>
        <Specimen label="scroll">
          <ScrollRow />
        </Specimen>
        <Specimen label="labelled group">
          <ChipRow label="Urgency">
            <Toggle initial>Today</Toggle>
            <Toggle>This week</Toggle>
            <Toggle>Whenever</Toggle>
          </ChipRow>
        </Specimen>
      </>
    ),
  },
];

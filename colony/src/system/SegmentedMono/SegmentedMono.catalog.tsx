import { useState } from "react";
import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { SegmentedMono } from "./SegmentedMono";

type Range = "7d" | "30d" | "90d" | "all";
const RANGES: { value: Range; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "all", label: "All" },
];

function RangeDemo({ initial }: { initial: Range }) {
  const [value, setValue] = useState<Range>(initial);
  return <SegmentedMono options={RANGES} value={value} onChange={setValue} label="Range" />;
}

type Pair = "spent" | "left";
function PairDemo() {
  const [value, setValue] = useState<Pair>("spent");
  return (
    <SegmentedMono
      options={[
        { value: "spent", label: "Spent" },
        { value: "left", label: "Left" },
      ]}
      value={value}
      onChange={setValue}
      label="Budget facet"
    />
  );
}

export const entries: CatalogEntry[] = [
  {
    id: "segmented-mono",
    name: "SegmentedMono",
    group: "Pressables",
    tasks: ["pick a time range", "pick one facet of a chart", "filter a list by one axis"],
    variants: ["first checked", "last checked", "two segments", "keyboard: arrows, Home, End"],
    render: () => (
      <>
        <Specimen label="first checked">
          <RangeDemo initial="7d" />
        </Specimen>
        <Specimen label="last checked">
          <RangeDemo initial="all" />
        </Specimen>
        <Specimen label="two segments">
          <PairDemo />
        </Specimen>
        <Specimen label="keyboard: arrows, Home, End">
          <RangeDemo initial="30d" />
        </Specimen>
      </>
    ),
  },
];

import { useState } from "react";
import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { Button } from "@/system/Button/Button";
import { Loading } from "./Loading";

/* once: the 750ms curating window, then a swap. */
function LiveOnce() {
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(false);
  return (
    <div style={{ display: "grid", gap: "var(--padding-med)", width: "100%" }}>
      {run > 0 && !done ? <Loading key={run} once duration={750} label="Curating" /> : <span className="label-small meta">{done ? "Swapped after 750ms" : "Not started"}</span>}
      <Button
        variant="grey"
        hideIcon
        onClick={() => {
          setDone(false);
          setRun((n) => n + 1);
          setTimeout(() => setDone(true), 750);
        }}
      >
        Sweep once
      </Button>
    </div>
  );
}

export const entries: CatalogEntry[] = [
  {
    id: "loading",
    name: "Loading",
    group: "Feedback",
    tasks: ["wait for something", "curating a few people", "the boot", "a sweep that ends with a swap"],
    variants: ["bar", "bar label", "bar once (live)", "sentence"],
    render: () => (
      <>
        <Specimen label="bar">
          <Loading />
        </Specimen>
        <Specimen label="bar, label">
          <Loading label="Reading the colony" />
        </Specimen>
        <Specimen label="bar, once (live)">
          <LiveOnce />
        </Specimen>
        <Specimen label="sentence">
          <Loading kind="sentence">Curating a few people who fit your colony</Loading>
        </Specimen>
      </>
    ),
  },
];

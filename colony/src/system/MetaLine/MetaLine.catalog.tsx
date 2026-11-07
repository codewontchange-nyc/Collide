import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { fmt } from "@/domain/money";
import { MetaLine } from "./MetaLine";

export const entries: CatalogEntry[] = [
  {
    id: "meta-line",
    name: "MetaLine",
    group: "Text and heads",
    tasks: ["date and time under a row title", "the trail above a page title", "a count in a panel head", "facts joined by middots"],
    variants: ["meta", "secondary", "ink", "one fact", "many facts (wraps between facts)", "with money", "as span", "conditional facts"],
    render: () => (
      <>
        <Specimen label="meta">
          <MetaLine facts={["Colony system", "42 components", "v0.1.0"]} />
        </Specimen>
        <Specimen label="secondary">
          <MetaLine tone="secondary" facts={["Nov 5", "9:00 AM"]} />
        </Specimen>
        <Specimen label="ink">
          <MetaLine tone="ink" facts={["Provider view", "Today"]} />
        </Specimen>
        <Specimen label="one fact">
          <MetaLine facts={["4 of 28 this month"]} />
        </Specimen>
        <Specimen label="many facts (wraps between facts)">
          <div style={{ width: "160px" }}>
            <MetaLine facts={["Thursday", "6:30 PM", "Dekalb & Bergen", "Six people", "Every week"]} />
          </div>
        </Specimen>
        <Specimen label="with money">
          <MetaLine tone="secondary" facts={[fmt(420000), "Of " + fmt(400000), "This month"]} />
        </Specimen>
        <Specimen label="as span">
          <p className="paragraph-x-small">
            Next visit <MetaLine as="span" tone="secondary" facts={["Nov 12", "10:00 AM"]} /> with Alejandra.
          </p>
        </Specimen>
        <Specimen label="conditional facts">
          <MetaLine facts={["Nov 5", null, false, "", "Handled"]} />
        </Specimen>
      </>
    ),
  },
];

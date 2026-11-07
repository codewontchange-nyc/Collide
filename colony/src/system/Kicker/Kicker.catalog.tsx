import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { Kicker } from "./Kicker";

export const entries: CatalogEntry[] = [
  {
    id: "kicker",
    name: "Kicker",
    group: "Text and heads",
    tasks: ["eyebrow above a title", "name a place in a trail", "label a control", "say where you are"],
    variants: ["secondary", "meta", "ink", "as span", "as div", "with a figure"],
    render: () => (
      <>
        <Specimen label="secondary">
          <Kicker>This week</Kicker>
        </Specimen>
        <Specimen label="meta">
          <Kicker tone="meta">Provider view</Kicker>
        </Specimen>
        <Specimen label="ink">
          <Kicker tone="ink">Budget</Kicker>
        </Specimen>
        <Specimen label="as span">
          <p className="paragraph-x-small">
            <Kicker as="span">Nov 5</Kicker> is the next dinner.
          </p>
        </Specimen>
        <Specimen label="as div">
          <Kicker as="div" tone="meta">
            4 of 28 this month
          </Kicker>
        </Specimen>
        <Specimen label="with a figure">
          <div style={{ display: "grid", gap: "var(--padding-x-small)" }}>
            <Kicker>Handled</Kicker>
            <span className="headline-medium tnum">12</span>
          </div>
        </Specimen>
      </>
    ),
  },
];

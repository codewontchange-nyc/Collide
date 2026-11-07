import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { Caret, DotArrow, Glyph, type GlyphName } from "./Glyph";

const NAMES: GlyphName[] = [
  "search",
  "close",
  "plus",
  "minus",
  "check",
  "chevron-down",
  "chevron-right",
  "chevron-left",
  "external",
  "filter",
  "sort",
  "more",
  "menu",
  "copy",
  "link",
  "calendar",
  "clock",
  "install",
  "share",
];

export const entries: CatalogEntry[] = [
  {
    id: "glyph",
    name: "Glyph",
    group: "Foundations",
    tasks: ["show an action", "point somewhere", "mark a kind of thing", "icon"],
    variants: [...NAMES, "label", "dot arrow", "caret up", "caret down", "caret flat"],
    render: () => (
      <>
        {NAMES.map((name) => (
          <Specimen key={name} label={name}>
            <Glyph name={name} />
          </Specimen>
        ))}
        <Specimen label="label">
          <Glyph name="search" label="Search" />
        </Specimen>
        <Specimen label="dot arrow">
          <DotArrow />
        </Specimen>
        <Specimen label="caret up">
          <Caret direction="up" />
        </Specimen>
        <Specimen label="caret down">
          <Caret direction="down" />
        </Specimen>
        <Specimen label="caret flat">
          <Caret direction="flat" />
        </Specimen>
      </>
    ),
  },
];

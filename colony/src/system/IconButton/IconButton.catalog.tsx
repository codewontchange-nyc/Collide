import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { IconButton } from "./IconButton";

export const entries: CatalogEntry[] = [
  {
    id: "icon-button",
    name: "IconButton",
    group: "Pressables",
    tasks: ["go back", "close", "close a sheet", "advance a month", "one glyph in a 44px square"],
    variants: ["secondary", "ink", "back", "close", "clock", "more", "disabled", "href"],
    render: () => (
      <>
        <Specimen label="secondary">
          <IconButton icon="chevron-left" label="Back" />
        </Specimen>
        <Specimen label="ink">
          <IconButton icon="close" label="Close" tone="ink" />
        </Specimen>
        <Specimen label="back">
          <IconButton icon="chevron-left" label="Back" />
        </Specimen>
        <Specimen label="close">
          <IconButton icon="close" label="Close" />
        </Specimen>
        <Specimen label="clock">
          <IconButton icon="clock" label="Advance a month" />
        </Specimen>
        <Specimen label="more">
          <IconButton icon="more" label="More" />
        </Specimen>
        <Specimen label="disabled">
          <IconButton icon="chevron-left" label="Back" disabled />
          <IconButton icon="close" label="Close" tone="ink" disabled />
        </Specimen>
        <Specimen label="href">
          <IconButton icon="external" label="System library" href="/system" />
          <IconButton icon="external" label="Elsewhere" href="https://example.com" disabled />
        </Specimen>
      </>
    ),
  },
];

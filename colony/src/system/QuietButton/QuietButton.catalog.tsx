import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { QuietButton } from "./QuietButton";

export const entries: CatalogEntry[] = [
  {
    id: "quiet-button",
    name: "QuietButton",
    group: "Pressables",
    tasks: ["clear", "load more", "read the whole thing", "remove", "add a person", "copy", "secondary action in a head", "back to member"],
    variants: ["secondary", "ink", "icon", "disabled", "href", "in a row"],
    render: () => (
      <>
        <Specimen label="secondary">
          <QuietButton>Clear</QuietButton>
        </Specimen>
        <Specimen label="ink">
          <QuietButton tone="ink">Back to member</QuietButton>
        </Specimen>
        <Specimen label="icon">
          <QuietButton icon="plus">Add a person</QuietButton>
          <QuietButton icon="copy" tone="ink">
            Copy
          </QuietButton>
        </Specimen>
        <Specimen label="disabled">
          <QuietButton disabled>Load more</QuietButton>
          <QuietButton tone="ink" disabled>
            Remove
          </QuietButton>
        </Specimen>
        <Specimen label="href">
          <QuietButton href="/system">Read the whole thing</QuietButton>
          <QuietButton href="https://example.com" disabled>
            Elsewhere
          </QuietButton>
        </Specimen>
        <Specimen label="in a row">
          <QuietButton>Less</QuietButton>
          <QuietButton>More</QuietButton>
          <QuietButton tone="ink">Remove</QuietButton>
        </Specimen>
      </>
    ),
  },
];

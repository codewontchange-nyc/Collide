import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { Quote } from "./Quote";

export const entries: CatalogEntry[] = [
  {
    id: "quote",
    name: "Quote",
    group: "Text and heads",
    tasks: ["the promise on the budget step", "a line from the manifesto", "a sentence read once", "a quote with its source"],
    variants: ["medium", "large", "cite", "tone ink"],
    render: () => (
      <>
        <Specimen label="medium">
          <Quote>The pool is what we hold together, for the things no one household can carry alone.</Quote>
        </Specimen>
        <Specimen label="large">
          <Quote size="large">Everyone has a role. Each one is vital.</Quote>
        </Specimen>
        <Specimen label="cite">
          <Quote cite="The colony manifesto">A colony is not a service. It is the people on your street who have agreed to notice.</Quote>
        </Specimen>
        <Specimen label="tone ink">
          <Quote tone="ink" cite="Marisol, Dekalb Ave">
            We fixed the faucet, then we stayed for dinner.
          </Quote>
        </Specimen>
      </>
    ),
  },
];

import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { QuietButton } from "@/system/QuietButton/QuietButton";
import { toast } from "@/system/Toast/Toast";
import { Companion } from "./Companion";
import { companion } from "./companion";

export const entries: CatalogEntry[] = [
  {
    id: "companion",
    name: "Companion",
    group: "Shell",
    tasks: ["the living mark in the masthead", "breathe at rest", "gather while curating", "nod when something is handled", "say one line"],
    variants: ["store driven (rest, gather, nod, say)", "mood rest", "mood gather", "mood nod", "say with a merged toast"],
    render: () => (
      <>
        <Specimen label="store driven (rest, gather, nod, say)">
          <Companion />
          <QuietButton onClick={() => companion.rest()}>Rest</QuietButton>
          <QuietButton onClick={() => companion.gather()}>Gather</QuietButton>
          <QuietButton onClick={() => companion.nod()}>Nod</QuietButton>
          <QuietButton tone="ink" onClick={() => companion.say("Booked. We will let them know.")}>
            Say
          </QuietButton>
        </Specimen>
        <Specimen label="mood rest">
          <Companion mood="rest" />
        </Specimen>
        <Specimen label="mood gather">
          <Companion mood="gather" />
        </Specimen>
        <Specimen label="mood nod">
          <Companion mood="nod" />
        </Specimen>
        <Specimen label="say with a merged toast">
          <QuietButton
            tone="ink"
            onClick={() => {
              companion.say("Booked. We will let them know.");
              toast.show("Noted. We will handle it.", { kind: "success" });
            }}
          >
            Say and toast
          </QuietButton>
        </Specimen>
      </>
    ),
  },
];

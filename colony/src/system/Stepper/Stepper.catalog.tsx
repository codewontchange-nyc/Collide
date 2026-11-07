import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { Stepper } from "./Stepper";

const MEMBERSHIP = [
  { label: "Trial", hint: "Four weeks, no card" },
  { label: "Household", hint: "One colony, every role" },
  { label: "Steward", hint: "You hold the budget" },
];

const MATCH = [
  { label: "Asked", hint: "Kitchen faucet drips", href: "/needs" },
  { label: "Curated", hint: "Three people who fit", href: "/needs" },
  { label: "Booked" },
  { label: "Done" },
];

export const entries: CatalogEntry[] = [
  {
    id: "stepper",
    name: "Stepper",
    group: "Forms",
    tasks: ["show where a thing is in a sequence", "a membership timeline", "a match timeline", "go back to a done step"],
    variants: ["column", "first step current", "last step current", "hints", "done steps as links (href)", "no hints"],
    render: () => (
      <>
        <Specimen label="column, first step current">
          <Stepper label="Membership" steps={MEMBERSHIP} current={0} />
        </Specimen>
        <Specimen label="middle step current, hints">
          <Stepper label="Membership" steps={MEMBERSHIP} current={1} />
        </Specimen>
        <Specimen label="last step current">
          <Stepper label="Membership" steps={MEMBERSHIP} current={2} />
        </Specimen>
        <Specimen label="done steps as links (href)">
          <Stepper label="Match" steps={MATCH} current={2} />
        </Specimen>
        <Specimen label="no hints">
          <Stepper label="Start" steps={[{ label: "Name your colony" }, { label: "Invite your tribe" }, { label: "Bring your current team" }, { label: "Set the budget" }]} current={1} />
        </Specimen>
      </>
    ),
  },
];

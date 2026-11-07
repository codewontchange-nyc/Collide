import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { MEMBER_TABS, PROVIDER_TABS, TabBar } from "./TabBar";

const WITH_COUNT = MEMBER_TABS.map((t) => (t.to === "/needs" ? { ...t, count: 4 } : t));

export const entries: CatalogEntry[] = [
  {
    id: "tab-bar",
    name: "TabBar",
    group: "Shell",
    tasks: [
      "move between the member tabs",
      "move between the provider tabs",
      "see which tab you are on",
      "see how many needs want you",
      "library only: inline, in flow",
      "library only: current, the tab shown as current when no route matches",
    ],
    variants: ["member tabs (shown in place, Home current)", "provider tabs (shown in place, Today current)", "count beside Needs (Needs current)", "label"],
    render: () => (
      <>
        <Specimen label="member tabs (shown in place, Home current)">
          <div style={{ width: "100%" }}>
            <TabBar tabs={MEMBER_TABS} inline current="/" />
          </div>
        </Specimen>
        <Specimen label="provider tabs (shown in place, Today current)">
          <div style={{ width: "100%" }}>
            <TabBar tabs={PROVIDER_TABS} inline current="/provider" label="Provider" />
          </div>
        </Specimen>
        <Specimen label="count beside Needs (Needs current)">
          <div style={{ width: "100%" }}>
            <TabBar tabs={WITH_COUNT} inline current="/needs" label="Member, with a count" />
          </div>
        </Specimen>
      </>
    ),
  },
];

import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { MEMBER_TABS, PROVIDER_TABS, TabBar } from "./TabBar";

const WITH_COUNT = MEMBER_TABS.map((t) => (t.to === "/needs" ? { ...t, count: 2 } : t));

export const entries: CatalogEntry[] = [
  {
    id: "tab-bar",
    name: "TabBar",
    group: "Shell",
    tasks: ["move between the member tabs", "move between the provider tabs", "see which tab you are on", "see how many needs want you"],
    variants: ["member tabs (shown in place)", "provider tabs (shown in place)", "count beside Needs", "label"],
    render: () => (
      <>
        <Specimen label="member tabs (shown in place)">
          <div style={{ width: "100%" }}>
            <TabBar tabs={MEMBER_TABS} inline />
          </div>
        </Specimen>
        <Specimen label="provider tabs (shown in place)">
          <div style={{ width: "100%" }}>
            <TabBar tabs={PROVIDER_TABS} inline label="Provider" />
          </div>
        </Specimen>
        <Specimen label="count beside Needs">
          <div style={{ width: "100%" }}>
            <TabBar tabs={WITH_COUNT} inline label="Member, with a count" />
          </div>
        </Specimen>
      </>
    ),
  },
];

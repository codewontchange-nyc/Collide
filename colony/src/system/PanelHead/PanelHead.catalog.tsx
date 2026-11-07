import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { fmt } from "@/domain/money";
import { Figure } from "@/system/Figure/Figure";
import { List, ListRow } from "@/system/List/List";
import { QuietButton } from "@/system/QuietButton/QuietButton";
import { Page, Panel, PanelHead } from "./PanelHead";

const full = { width: "100%" } as const;

export const entries: CatalogEntry[] = [
  {
    id: "panel-head",
    name: "PanelHead",
    group: "Text and heads",
    tasks: ["head a module", "head a list", "count what the list holds", "copy or clear from a head", "explain a module in one line"],
    variants: ["title", "index", "meta", "rule ink", "description", "action", "meta and action", "headingLevel 3", "with a List rule none"],
    render: () => (
      <>
        <Specimen label="title">
          <div style={full}>
            <PanelHead title="This week" />
          </div>
        </Specimen>
        <Specimen label="index">
          <div style={full}>
            <PanelHead index="01" title="Tokens" />
          </div>
        </Specimen>
        <Specimen label="meta">
          <div style={full}>
            <PanelHead title="Dinners" meta="4 of 28 this month" />
          </div>
        </Specimen>
        <Specimen label="rule ink">
          <div style={full}>
            <PanelHead title="Top weeks" rule="ink" meta="This month" />
          </div>
        </Specimen>
        <Specimen label="description">
          <div style={full}>
            <PanelHead title="The pool" description="What the colony holds together, for the things no one household can carry alone." />
          </div>
        </Specimen>
        <Specimen label="action">
          <div style={full}>
            <PanelHead title="Invite code" action={<QuietButton>Copy</QuietButton>} />
          </div>
        </Specimen>
        <Specimen label="meta and action">
          <div style={full}>
            <PanelHead index="07" title="Button" meta="Pressables" action={<QuietButton>Copy</QuietButton>} description="confirm, primary action, go forward" />
          </div>
        </Specimen>
        <Specimen label="headingLevel 3">
          <div style={full}>
            <PanelHead headingLevel={3} title="A sub head" />
          </div>
        </Specimen>
        <Specimen label="with a List rule none">
          <div style={full}>
            <Panel aria-labelledby="catalog-panel-ledger">
              <PanelHead id="catalog-panel-ledger" title="Ledger" rule="ink" meta="November" />
              <List rule="none">
                <ListRow title="Direct" trailing={<Figure size="sm" value={352000} format={fmt} />} />
                <ListRow title="Pool" trailing={<Figure size="sm" value={216000} format={fmt} />} />
              </List>
            </Panel>
          </div>
        </Specimen>
      </>
    ),
  },
  {
    id: "panel",
    name: "Panel",
    group: "Text and heads",
    tasks: ["a module on a page", "group a head and its list", "the page column outside a Screen"],
    variants: ["Panel section", "Panel as div with label", "Page"],
    render: () => (
      <>
        <Specimen label="Panel section">
          <div style={full}>
            <Panel aria-labelledby="catalog-panel-week">
              <PanelHead id="catalog-panel-week" title="This week" />
              <List rule="none">
                <ListRow title="Dinner at the Nguyens" facts={["Thu", "7:00 PM"]} />
              </List>
            </Panel>
          </div>
        </Specimen>
        <Specimen label="Panel as div with label">
          <div style={full}>
            <Panel as="div" label="Facts">
              <List>
                <ListRow title="A plain group" />
              </List>
            </Panel>
          </div>
        </Specimen>
        <Specimen label="Page">
          <div style={full}>
            <Page className="ig-page--specimen">
              <Panel>
                <PanelHead title="Inside a Page" />
              </Panel>
            </Page>
          </div>
        </Specimen>
      </>
    ),
  },
];

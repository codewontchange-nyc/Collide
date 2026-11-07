import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { Card, CardBody, CardTitle } from "@/system/Card/Card";
import { Rise, Screen } from "./Screen";

export const entries: CatalogEntry[] = [
  {
    id: "screen",
    name: "Screen",
    group: "Shell",
    tasks: ["the page column", "a route that rises in", "a dark welcome", "remember where the reader was"],
    variants: ["default (in place)", "bare", "mode dark"],
    render: () => (
      <>
        <Specimen label="default (in place)">
          <div style={{ width: "100%" }}>
            <Screen restoreScroll={false} scrollKey="catalog-screen" className="ig-page--specimen">
              <Rise index={0}>
                <Card>
                  <CardTitle>A page column</CardTitle>
                  <CardBody>Grid, 32px gaps, the gutter, the tab bar clearance below.</CardBody>
                </Card>
              </Rise>
            </Screen>
          </div>
        </Specimen>
        <Specimen label="bare">
          <div style={{ width: "100%" }}>
            <Screen bare restoreScroll={false} scrollKey="catalog-screen-bare" className="ig-page--specimen">
              <Rise index={0}>
                <Card>
                  <CardTitle>No tab bar</CardTitle>
                  <CardBody>Welcome and Start: the bottom padding reads the safe area alone.</CardBody>
                </Card>
              </Rise>
            </Screen>
          </div>
        </Specimen>
        <Specimen label="mode dark">
          <div style={{ width: "100%" }}>
            <Screen bare mode="dark" restoreScroll={false} scrollKey="catalog-screen-dark" className="ig-page--specimen">
              <Rise index={0}>
                <Card>
                  <CardTitle>Dark tokens</CardTitle>
                  <CardBody>The ladder mirrors under data-mode; nothing names a dark color.</CardBody>
                </Card>
              </Rise>
            </Screen>
          </div>
        </Specimen>
      </>
    ),
  },
  {
    id: "rise",
    name: "Rise",
    group: "Shell",
    tasks: ["stagger a page's modules", "fade and lift a block in", "appear with the capped delay"],
    variants: ["index 0", "index 1", "index 2", "index 8 (capped)", "as section"],
    render: () => (
      <>
        <Specimen label="index 0, 1, 2, 8 (capped)">
          <div style={{ display: "grid", gap: "var(--padding-med)", width: "100%" }}>
            {[0, 1, 2, 8].map((i) => (
              <Rise key={i} index={i}>
                <Card ground="ground">
                  <CardTitle>Index {i}</CardTitle>
                  <CardBody>{i === 8 ? "Delay capped at 240ms." : `Delay ${i * 55}ms.`}</CardBody>
                </Card>
              </Rise>
            ))}
          </div>
        </Specimen>
        <Specimen label="as section">
          <Rise as="section" index={0}>
            <Card>
              <CardTitle>A section</CardTitle>
            </Card>
          </Rise>
        </Specimen>
      </>
    ),
  },
];

import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { fmt } from "@/domain/money";
import { Avatar } from "@/system/Avatar/Avatar";
import { Button } from "@/system/Button/Button";
import { Companion } from "@/system/Companion/Companion";
import { Figure } from "@/system/Figure/Figure";
import { MetaLine } from "@/system/MetaLine/MetaLine";
import { MetricStrip } from "@/system/MetricStrip/MetricStrip";
import { QuietButton } from "@/system/QuietButton/QuietButton";
import { StatusWord } from "@/system/SignalDot/SignalDot";
import { PageIntro } from "./PageIntro";

const full = { width: "100%" } as const;

export const entries: CatalogEntry[] = [
  {
    id: "page-intro",
    name: "PageIntro",
    group: "Text and heads",
    tasks: ["open a page", "say where you are", "the two tone title", "the lede from the engine", "go back", "scope the lists under the title"],
    variants: [
      "title only",
      "titleMuted",
      "eyebrow string",
      "eyebrow MetaLine",
      "back",
      "aside Companion",
      "aside Avatar",
      "aside QuietButton",
      "aside StatusWord",
      "intro",
      "editorial",
      "actions",
      "children (under slot)",
      "headingLevel 2",
    ],
    render: () => (
      <>
        <Specimen label="title only">
          <div style={full}>
            <PageIntro title="Needs" />
          </div>
        </Specimen>
        <Specimen label="titleMuted">
          <div style={full}>
            <PageIntro title="One budget," titleMuted="well kept" />
          </div>
        </Specimen>
        <Specimen label="eyebrow string">
          <div style={full}>
            <PageIntro eyebrow="This week" title="Your colony" titleMuted="this week" />
          </div>
        </Specimen>
        <Specimen label="eyebrow MetaLine">
          <div style={full}>
            <PageIntro eyebrow={<MetaLine facts={["Provider view", "Nov 5", "3 visits"]} />} title="Today," titleMuted="Marisol" />
          </div>
        </Specimen>
        <Specimen label="back">
          <div style={full}>
            <PageIntro back={{ label: "Back to You", onPress: () => undefined }} eyebrow="You" title="Membership" />
          </div>
        </Specimen>
        <Specimen label="aside Companion">
          <div style={full}>
            <PageIntro eyebrow="Dekalb and Bergen" aside={<Companion mood="rest" />} title="Your colony" titleMuted="this week" />
          </div>
        </Specimen>
        <Specimen label="aside Avatar">
          <div style={full}>
            <PageIntro eyebrow="You" aside={<Avatar name="Marisol Vega" />} title="Marisol" />
          </div>
        </Specimen>
        <Specimen label="aside QuietButton">
          <div style={full}>
            <PageIntro
              eyebrow={<MetaLine facts={["Provider view", "Nov 5"]} />}
              aside={<QuietButton tone="ink">Back to member</QuietButton>}
              title="Today,"
              titleMuted="Marisol"
            />
          </div>
        </Specimen>
        <Specimen label="aside StatusWord">
          <div style={full}>
            <PageIntro eyebrow="Membership" aside={<StatusWord state="success">Active</StatusWord>} title="Membership" />
          </div>
        </Specimen>
        <Specimen label="intro">
          <div style={full}>
            <PageIntro title="Needs" titleMuted="most of them handled" intro="Two things still want a decision from you." />
          </div>
        </Specimen>
        <Specimen label="editorial">
          <div style={full}>
            <PageIntro
              title="Your colony"
              titleMuted="this week"
              editorial
              intro="Twelve things handled, four dinners on the table, and the pool is holding steady at ninety two dollars."
            />
          </div>
        </Specimen>
        <Specimen label="actions">
          <div style={full}>
            <PageIntro
              title="Set the budget"
              intro="You can change this any time."
              actions={
                <>
                  <Button>Continue</Button>
                  <QuietButton>Skip for now</QuietButton>
                </>
              }
            />
          </div>
        </Specimen>
        <Specimen label="children (under slot)">
          <div style={full}>
            <PageIntro title="One budget," titleMuted="well kept" editorial intro="Spending is on pace; the pool grew this week.">
              <MetricStrip
                columns={2}
                items={[
                  { label: "Spent", value: <Figure size="md" value={184050} format={fmt} /> },
                  { label: "Pool", value: <Figure size="md" value={92000} format={fmt} /> },
                ]}
              />
            </PageIntro>
          </div>
        </Specimen>
        <Specimen label="headingLevel 2">
          <div style={full}>
            <PageIntro headingLevel={2} eyebrow="Step 1 of 4" title="Name your colony" />
          </div>
        </Specimen>
      </>
    ),
  },
];

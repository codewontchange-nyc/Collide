import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { fmt } from "@/domain/money";
import { Avatar } from "@/system/Avatar/Avatar";
import { Figure } from "@/system/Figure/Figure";
import { QuietButton } from "@/system/QuietButton/QuietButton";
import { StatusWord } from "@/system/SignalDot/SignalDot";
import { Tag } from "@/system/Tag/Tag";
import { List, ListRow } from "./List";

const full = { width: "100%" } as const;

export const entries: CatalogEntry[] = [
  {
    id: "list",
    name: "List",
    group: "Lists and cards",
    tasks: ["group rows", "a ranked list", "a ledger", "a plain group under a panel head"],
    variants: ["rule ink", "rule hairline", "rule none", "density touch", "density dense", "density reading", "as ol", "as div", "label"],
    render: () => (
      <>
        <Specimen label="rule ink">
          <div style={full}>
            <List rule="ink" label="Top weeks">
              <ListRow index="01" title="Nov 9 to 15" trailing={<Figure size="sm" value={240000} format={fmt} />} />
              <ListRow index="02" title="Nov 2 to 8" trailing={<Figure size="sm" value={176000} format={fmt} />} />
            </List>
          </div>
        </Specimen>
        <Specimen label="rule hairline">
          <div style={full}>
            <List>
              <ListRow title="Kitchen faucet drips" facts={["Plumbing", "Nov 5"]} />
              <ListRow title="Dinner at the Nguyens" facts={["Thu", "7:00 PM"]} />
            </List>
          </div>
        </Specimen>
        <Specimen label="rule none">
          <div style={full}>
            <List rule="none">
              <ListRow title="Under a panel head" facts="The head drew the rule." />
            </List>
          </div>
        </Specimen>
        <Specimen label="density touch, dense, reading">
          <div style={full}>
            <List label="Touch">
              <ListRow title="Touch row" facts={["44px", "12px 0"]} />
            </List>
            <List density="dense" label="Dense">
              <ListRow title="Dense row" facts={["8px 0"]} />
            </List>
            <List density="reading" label="Reading">
              <ListRow title="Reading row" facts="A sentence to read, with 16px above and below." />
            </List>
          </div>
        </Specimen>
        <Specimen label="as ol">
          <div style={full}>
            <List as="ol" rule="ink">
              <ListRow index="01" title="First" />
              <ListRow index="02" title="Second" />
            </List>
          </div>
        </Specimen>
        <Specimen label="as div">
          <div style={full}>
            <List as="div" label="Facts">
              <ListRow title="Not a list item" facts="The item is a div." />
            </List>
          </div>
        </Specimen>
      </>
    ),
  },
  {
    id: "list-row",
    name: "ListRow",
    group: "Lists and cards",
    tasks: ["a need", "a visit", "a person", "a ledger line", "a setting row", "open a sheet from a row", "a sum line"],
    variants: [
      "title only",
      "index",
      "indexWidth 6ch",
      "leading avatar",
      "leading tile",
      "facts array",
      "facts sentence",
      "factsLine",
      "trailing figure",
      "trailingMeta",
      "trailing status",
      "trailing tag",
      "trailing quiet button",
      "chevron",
      "onPress",
      "href",
      "disabled",
      "selected",
      "current",
      "rule ink",
      "ellipsis",
      "two line clamp",
      "titleAs h3",
    ],
    render: () => (
      <>
        <Specimen label="title only">
          <div style={full}>
            <List>
              <ListRow title="Nothing scheduled" />
            </List>
          </div>
        </Specimen>
        <Specimen label="index, indexWidth 6ch">
          <div style={full}>
            <List rule="ink">
              <ListRow index="01" title="Marisol Vega" facts={["Plumbing", "4 visits"]} />
              <ListRow index="NOV 5" indexWidth="6ch" title="Kitchen faucet drips" facts={["9:00 AM"]} />
              <ListRow index="2:00 PM" indexWidth="7ch" title="Dinner" facts={["The Nguyens"]} />
            </List>
          </div>
        </Specimen>
        <Specimen label="leading avatar, leading tile">
          <div style={full}>
            <List>
              <ListRow leading={<Avatar name="Marisol Vega" />} title="Marisol Vega" facts={["Plumbing", "Rated 4.9"]} chevron onPress={() => undefined} />
              <ListRow
                leading={
                  <span className="ig-row__tile headline-small" aria-hidden="true">
                    K
                  </span>
                }
                title="Kitchen faucet drips"
                facts={["Plumbing", "Nov 5"]}
                trailing={<StatusWord state="default" pulse>Needs you</StatusWord>}
              />
            </List>
          </div>
        </Specimen>
        <Specimen label="facts array, facts sentence, factsLine">
          <div style={full}>
            <List>
              <ListRow title="Dinner at the Nguyens" facts={["Thu", "7:00 PM", "8 of you"]} />
              <ListRow title="Theo Nguyen" facts="Keeps the garden and the Thursday table." />
              <ListRow title="Priya Raman" facts="Steward of the pool." factsLine={["Bookkeeping", "Since May"]} />
            </List>
          </div>
        </Specimen>
        <Specimen label="trailing figure, trailingMeta">
          <div style={full}>
            <List rule="ink">
              <ListRow title="Marisol Vega" facts={["Plumbing"]} trailing={<Figure size="sm" value={176000} format={fmt} />} trailingMeta="$1,760 at home" />
              <ListRow title="Budget" trailing={<Figure size="sm" value={400000} format={fmt} />} trailingMeta="a month" />
            </List>
          </div>
        </Specimen>
        <Specimen label="trailing status, tag, quiet button">
          <div style={full}>
            <List>
              <ListRow title="Faucet fixed" facts={["Nov 2"]} trailing={<StatusWord state="success">Done</StatusWord>} />
              <ListRow title="Provider view" trailing={<Tag tone="ink">Steward</Tag>} />
              <ListRow title="Owen Hart" facts={["Carpentry"]} trailing={<QuietButton>Remove</QuietButton>} />
            </List>
          </div>
        </Specimen>
        <Specimen label="chevron, onPress, href">
          <div style={full}>
            <List>
              <ListRow title="Membership" facts={["$149 a month"]} chevron onPress={() => undefined} />
              <ListRow title="System library" facts="Every component, every variant." chevron href="/system" />
            </List>
          </div>
        </Specimen>
        <Specimen label="disabled">
          <div style={full}>
            <List>
              <ListRow title="Nothing scheduled" facts="Come back after the next dinner." chevron onPress={() => undefined} disabled />
              <ListRow title="Not pressable, disabled" facts={["Later"]} disabled />
            </List>
          </div>
        </Specimen>
        <Specimen label="selected, current">
          <div style={full}>
            <List>
              <ListRow title="Dekalb and Bergen" facts={["Selected"]} selected onPress={() => undefined} />
              <ListRow title="Set the budget" facts={["Step 4 of 4"]} current />
              <ListRow title="Plain" />
            </List>
          </div>
        </Specimen>
        <Specimen label="rule ink (a sum line)">
          <div style={full}>
            <List rule="ink">
              <ListRow title="Direct" trailing={<Figure size="sm" value={352000} format={fmt} />} />
              <ListRow title="Pool" trailing={<Figure size="sm" value={216000} format={fmt} />} />
              <ListRow rule="ink" title="Together" trailing={<Figure size="sm" value={568000} format={fmt} />} />
            </List>
          </div>
        </Specimen>
        <Specimen label="ellipsis, two line clamp, titleAs h3">
          <div style={full}>
            <List>
              <ListRow ellipsis title="A very long title that would otherwise wrap onto a second line and so is cut with an ellipsis" />
              <ListRow title="A very long title that is allowed two lines before it is clamped, and then no more than that, so it stays tidy in a 343px column" />
              <ListRow titleAs="h3" title="A heading row" facts="The title is an h3." />
            </List>
          </div>
        </Specimen>
      </>
    ),
  },
];

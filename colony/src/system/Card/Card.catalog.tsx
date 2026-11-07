import { useState } from "react";
import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { Button } from "@/system/Button/Button";
import { StatusWord } from "@/system/SignalDot/SignalDot";
import { Card, CardBody, CardTitle, CardTop } from "./Card";

/** A pickable card that keeps its own pressed state, for the specimen. */
function Pickable() {
  const [pressed, setPressed] = useState(false);
  return (
    <Card onPress={() => setPressed((p) => !p)} pressed={pressed}>
      <CardTop>
        <CardTitle>Alejandra Fernandez</CardTitle>
        <StatusWord state="success">Available</StatusWord>
      </CardTop>
      <CardBody>Plumbing, 4 visits this month. Tap to pick.</CardBody>
    </Card>
  );
}

export const entries: CatalogEntry[] = [
  {
    id: "card",
    name: "Card",
    group: "Lists and cards",
    tasks: ["group a few lines", "pick one of a few", "the next visit", "the welcome card", "a household card"],
    variants: ["edge", "ground", "inverted", "top and body", "pressable", "href", "pressed (aria-pressed)", "selected edge", "selected ground", "as li"],
    render: () => (
      <>
        <Specimen label="edge">
          <Card>
            <CardTitle>Dekalb and Bergen</CardTitle>
            <CardBody>Two households, one budget.</CardBody>
          </Card>
        </Specimen>
        <Specimen label="ground" ground="surface">
          <Card ground="ground">
            <CardTitle>Next charge</CardTitle>
            <CardBody>$149 on Dec 1.</CardBody>
          </Card>
        </Specimen>
        <Specimen label="inverted">
          <Card ground="inverted">
            <CardTop>
              <CardTitle>Next visit</CardTitle>
              <span className="label-small">2:00 PM</span>
            </CardTop>
            <CardBody>Marisol, kitchen faucet drips. 12 Dekalb Ave.</CardBody>
            <Button variant="glassy" hideIcon>
              Open visit
            </Button>
          </Card>
        </Specimen>
        <Specimen label="top and body">
          <Card>
            <CardTop>
              <CardTitle>Dinner on Thursday</CardTitle>
              <StatusWord state="success">Scheduled</StatusWord>
            </CardTop>
            <CardBody>Eight of you, at the Nguyens.</CardBody>
          </Card>
        </Specimen>
        <Specimen label="pressable">
          <Card onPress={() => undefined}>
            <CardTitle>Open the pool</CardTitle>
            <CardBody>See what the colony holds together.</CardBody>
          </Card>
        </Specimen>
        <Specimen label="href">
          <Card href="/system">
            <CardTitle>System library</CardTitle>
            <CardBody>Every component, every variant.</CardBody>
          </Card>
        </Specimen>
        <Specimen label="pressed (aria-pressed)">
          <Pickable />
        </Specimen>
        <Specimen label="selected edge">
          <Card selected>
            <CardTitle>The Nguyens</CardTitle>
            <CardBody>Selected household.</CardBody>
          </Card>
        </Specimen>
        <Specimen label="selected ground">
          <Card ground="ground" selected>
            <CardTitle>You, or the first person</CardTitle>
            <CardBody>Selected household.</CardBody>
          </Card>
        </Specimen>
        <Specimen label="as li">
          <ul style={{ display: "grid", gap: "var(--padding-med)", width: "100%" }}>
            <Card as="li">
              <CardTitle>One</CardTitle>
            </Card>
            <Card as="li" onPress={() => undefined}>
              <CardTitle>Two, pressable</CardTitle>
            </Card>
          </ul>
        </Specimen>
      </>
    ),
  },
];

import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { Card } from "@/system/Card/Card";
import { Avatar, AvatarStack } from "./Avatar";

const PEOPLE = [
  { name: "Marisol Vega", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=Marisol%20Vega&backgroundColor=f5ece2" },
  { name: "Theo Nguyen", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=Theo%20Nguyen&backgroundColor=f5ece2" },
  { name: "Alejandra Fernandez" },
  { name: "Priya Raman" },
  { name: "Owen Hart" },
  { name: "June Park" },
];

export const entries: CatalogEntry[] = [
  {
    id: "avatar",
    name: "Avatar",
    group: "People and time",
    tasks: ["show a person", "show who is coming", "show the household", "the You page", "style and the span's attributes pass through (the stack sets --ig-stack-z)"],
    variants: ["sm", "md", "lg", "image", "initials fallback", "broken image", "state success", "state default", "state error", "state inactive", "on an inverted card"],
    render: () => (
      <>
        <Specimen label="sm">
          <Avatar name="Marisol Vega" size="sm" />
        </Specimen>
        <Specimen label="md">
          <Avatar name="Marisol Vega" />
        </Specimen>
        <Specimen label="lg">
          <Avatar name="Marisol Vega" size="lg" />
        </Specimen>
        <Specimen label="image">
          <Avatar name="Theo Nguyen" src={PEOPLE[1].avatar} />
        </Specimen>
        <Specimen label="initials fallback">
          <Avatar name="Alejandra Fernandez" size="lg" />
        </Specimen>
        <Specimen label="broken image">
          <Avatar name="Priya Raman" src="https://example.invalid/missing.svg" />
        </Specimen>
        <Specimen label="state success, default, error, inactive">
          <Avatar name="Marisol Vega" state="success" />
          <Avatar name="Theo Nguyen" state="default" />
          <Avatar name="Priya Raman" state="error" />
          <Avatar name="Owen Hart" state="inactive" />
        </Specimen>
        <Specimen label="on an inverted card">
          <Card ground="inverted">
            <AvatarStack people={PEOPLE} max={3} />
          </Card>
        </Specimen>
      </>
    ),
  },
  {
    id: "avatar-stack",
    name: "AvatarStack",
    group: "People and time",
    tasks: ["show who is coming", "show a few people at once", "a dinner's guests"],
    variants: ["sm", "md", "max 4 with rest", "max 2", "fewer than max"],
    render: () => (
      <>
        <Specimen label="sm">
          <AvatarStack people={PEOPLE.slice(0, 3)} />
        </Specimen>
        <Specimen label="md">
          <AvatarStack people={PEOPLE.slice(0, 3)} size="md" />
        </Specimen>
        <Specimen label="max 4 with rest">
          <AvatarStack people={PEOPLE} />
        </Specimen>
        <Specimen label="max 2">
          <AvatarStack people={PEOPLE} max={2} size="md" />
        </Specimen>
        <Specimen label="fewer than max">
          <AvatarStack people={PEOPLE.slice(0, 2)} />
        </Specimen>
      </>
    ),
  },
];

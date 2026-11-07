import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { Button } from "./Button";

export const entries: CatalogEntry[] = [
  {
    id: "button",
    name: "Button",
    group: "Pressables",
    tasks: ["confirm", "primary action", "go forward", "submit a sheet", "not now", "secondary on a card", "irreversible action"],
    variants: ["dark", "grey", "light", "outlined", "glassy", "danger", "hideIcon", "icon", "block", "iconOnly", "disabled", "href", "long label"],
    render: () => (
      <>
        <Specimen label="dark">
          <Button>Continue</Button>
        </Specimen>
        <Specimen label="grey">
          <Button variant="grey" hideIcon>
            Not now
          </Button>
        </Specimen>
        <Specimen label="light" ground="ground">
          <Button variant="light">Find someone</Button>
        </Specimen>
        <Specimen label="outlined">
          <Button variant="outlined" hideIcon>
            Start your own colony
          </Button>
        </Specimen>
        <Specimen label="glassy" ground="inverted">
          <Button variant="glassy">Open visit</Button>
        </Specimen>
        <Specimen label="danger">
          <Button variant="danger" hideIcon>
            Reset the demo
          </Button>
        </Specimen>
        <Specimen label="hideIcon">
          <Button hideIcon>Done</Button>
        </Specimen>
        <Specimen label="icon">
          <Button icon="plus" hideIcon>
            Request something
          </Button>
        </Specimen>
        <Specimen label="block">
          <Button block>Continue</Button>
        </Specimen>
        <Specimen label="iconOnly">
          <Button iconOnly icon="plus">
            Request something
          </Button>
        </Specimen>
        <Specimen label="disabled">
          <Button disabled>Continue</Button>
          <Button variant="grey" hideIcon disabled>
            Not now
          </Button>
          <Button variant="outlined" hideIcon disabled>
            Later
          </Button>
        </Specimen>
        <Specimen label="href">
          <Button href="/system" hideIcon>
            System library
          </Button>
          <Button href="https://example.com" variant="grey" hideIcon disabled>
            Elsewhere
          </Button>
        </Specimen>
        <Specimen label="long label">
          <div style={{ width: "167px" }}>
            <Button block hideIcon>
              Book Alejandra Fernandez
            </Button>
          </div>
        </Specimen>
      </>
    ),
  },
  {
    id: "button-fab",
    name: "Button fab",
    group: "Shell",
    tasks: ["request something", "add something from anywhere on the screen", "floating action"],
    variants: ["labelled pill (shown in place)", "iconOnly square (shown in place)"],
    render: () => (
      <>
        <Specimen label="labelled pill (shown in place)">
          <Button icon="plus" hideIcon>
            Request something
          </Button>
        </Specimen>
        <Specimen label="iconOnly square (shown in place)">
          <Button iconOnly icon="plus">
            Request something
          </Button>
        </Specimen>
      </>
    ),
  },
];

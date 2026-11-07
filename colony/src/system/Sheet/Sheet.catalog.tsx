import { useState } from "react";
import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { fmt } from "@/domain/money";
import { Button } from "@/system/Button/Button";
import { Facts } from "@/system/Facts/Facts";
import { List, ListRow } from "@/system/List/List";
import { MetaLine } from "@/system/MetaLine/MetaLine";
import { Quote } from "@/system/Quote/Quote";
import { Figure } from "@/system/Figure/Figure";
import { Sheet, SheetContent } from "./Sheet";

type Kind = "visit" | "pool" | "manifesto" | "curating";

/** Opens a real Sheet. Swapping between kinds while open cross fades the body and never re animates the panel. */
function SheetDemo() {
  const [kind, setKind] = useState<Kind | null>(null);
  const close = () => setKind(null);
  return (
    <>
      <Button hideIcon onClick={() => setKind("visit")}>
        Open a sheet
      </Button>
      <Button variant="grey" hideIcon onClick={() => setKind("manifesto")}>
        Open dark
      </Button>
      <Button variant="grey" hideIcon onClick={() => setKind("curating")}>
        Open undismissable
      </Button>
      <Sheet open={kind !== null} onClose={close}>
        {kind === "visit" && (
          <SheetContent
            eyebrow={<MetaLine facts={["Nov 5", "2:00 PM", "Plumbing"]} />}
            title="Kitchen faucet drips"
            description="Marisol is booked. We will let her know if anything changes."
            actions={
              <>
                <Button hideIcon onClick={() => setKind("pool")}>
                  See the pool
                </Button>
                <Button variant="grey" hideIcon onClick={close}>
                  Not now
                </Button>
              </>
            }
          >
            <Facts
              items={[
                { label: "Home", value: "12 Dekalb Ave" },
                { label: "Engagement", value: "Every other week" },
              ]}
            />
            <List rule="ink">
              <ListRow title="Visit" trailing={<Figure size="sm" value={18000} format={fmt} />} />
              <ListRow title="From the pool" trailing={<Figure size="sm" value={4000} format={fmt} />} />
              <ListRow rule="ink" title="Together" trailing={<Figure size="sm" value={22000} format={fmt} />} />
            </List>
          </SheetContent>
        )}
        {kind === "pool" && (
          <SheetContent
            eyebrow="The pool"
            title="What the colony holds"
            actions={
              <Button hideIcon onClick={close}>
                Done
              </Button>
            }
          >
            <Figure size="md" value={92000} format={fmt} unit="this month" data-testid="catalog-pool" />
            <List rule="ink">
              {Array.from({ length: 8 }, (_, i) => (
                <ListRow key={i} index={String(i + 1).padStart(2, "0")} title={`Contribution ${i + 1}`} trailing={<Figure size="sm" value={1200 * (i + 1)} format={fmt} signed sign="+" />} />
              ))}
            </List>
          </SheetContent>
        )}
        {kind === "manifesto" && (
          <SheetContent mode="dark" eyebrow="Manifesto" title="Everyone has a role">
            <Quote size="large">Each one is vital. A colony is the people on your street who have agreed to notice.</Quote>
            <p className="paragraph-medium">The pool is what we hold together, for the things no one household can carry alone.</p>
          </SheetContent>
        )}
        {kind === "curating" && (
          <SheetContent dismissable={false}>
            <p className="paragraph-small">Curating a few people who fit your colony. This sheet cannot be dismissed until it is done.</p>
            <Button hideIcon onClick={() => setKind("visit")}>
              Done curating
            </Button>
          </SheetContent>
        )}
      </Sheet>
    </>
  );
}

function PropsDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outlined" hideIcon onClick={() => setOpen(true)}>
        Open with Sheet props
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Sheet props"
        title="Head and actions on the Sheet"
        description="The head and the action row can come from the Sheet itself when there is no SheetContent."
        closeLabel="Close this sheet"
        actions={
          <Button hideIcon onClick={() => setOpen(false)}>
            Done
          </Button>
        }
      >
        <p className="paragraph-small">The body.</p>
      </Sheet>
    </>
  );
}

export const entries: CatalogEntry[] = [
  {
    id: "sheet",
    name: "Sheet",
    group: "Shell",
    tasks: ["open a thing from a row", "confirm in place", "read the manifesto", "swap request to match", "close with the scrim, Escape or back"],
    variants: ["open (real sheet)", "swap without re animating", "mode dark", "dismissable false", "Sheet props head", "closeLabel"],
    render: () => (
      <>
        <Specimen label="open (real sheet), swap, mode dark, dismissable false">
          <SheetDemo />
        </Specimen>
        <Specimen label="Sheet props head, closeLabel">
          <PropsDemo />
        </Specimen>
      </>
    ),
  },
  {
    id: "sheet-content",
    name: "SheetContent",
    group: "Shell",
    tasks: ["the head of a sheet", "the action row", "a sheet file's shape"],
    variants: ["eyebrow, title, description, actions (shown in place)", "title only", "no title (curating)"],
    render: () => (
      <>
        <Specimen label="eyebrow, title, description, actions (shown in place)">
          <div style={{ width: "100%" }}>
            <SheetContent
              eyebrow={<MetaLine facts={["Nov 5", "2:00 PM"]} />}
              title="Kitchen faucet drips"
              description="Marisol is booked."
              actions={
                <>
                  <Button hideIcon>Book Marisol</Button>
                  <Button variant="grey" hideIcon>
                    Not now
                  </Button>
                </>
              }
            >
              <p className="paragraph-small">The body.</p>
            </SheetContent>
          </div>
        </Specimen>
        <Specimen label="title only">
          <div style={{ width: "100%" }}>
            <SheetContent title="Close November">
              <p className="paragraph-small">The body.</p>
            </SheetContent>
          </div>
        </Specimen>
        <Specimen label="no title (curating)">
          <div style={{ width: "100%" }}>
            <SheetContent dismissable={false}>
              <p className="label-small secondary">Curating a few people who fit</p>
            </SheetContent>
          </div>
        </Specimen>
      </>
    ),
  },
];

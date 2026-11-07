import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { Button } from "@/system/Button/Button";
import { toast } from "./Toast";

/* Live: every button fires toast.show on the real host the shell renders. */
export const entries: CatalogEntry[] = [
  {
    id: "toast",
    name: "ToastHost",
    group: "Feedback",
    tasks: ["confirm something just happened", "fire a toast from anywhere", "an update is ready (sticky)", "undo something", "one thing at a time with the companion"],
    variants: ["show default", "show success", "show error", "show with action", "show sticky (close)", "two at once (a third replaces the oldest)", "hold 1500ms then show", "dismiss"],
    render: () => (
      <>
        <Specimen label="show, default">
          <Button hideIcon onClick={() => toast.show("Noted. We will handle it.")}>
            Fire a toast
          </Button>
        </Specimen>
        <Specimen label="show, success">
          <Button variant="grey" hideIcon onClick={() => toast.show("Booked. We will let them know.", { kind: "success" })}>
            Success
          </Button>
        </Specimen>
        <Specimen label="show, error">
          <Button variant="grey" hideIcon onClick={() => toast.show("That did not go through.", { kind: "error" })}>
            Error
          </Button>
        </Specimen>
        <Specimen label="show with action">
          <Button variant="grey" hideIcon onClick={() => toast.show("Marked done.", { kind: "success", action: { label: "Undo", onClick: () => toast.show("Back in the queue.") } })}>
            With an action
          </Button>
        </Specimen>
        <Specimen label="show sticky (close)">
          <Button variant="grey" hideIcon onClick={() => toast.show("A fresh Colony is ready.", { sticky: true, action: { label: "Update", onClick: () => undefined } })}>
            Sticky
          </Button>
        </Specimen>
        <Specimen label="two at once (a third replaces the oldest)">
          <Button
            variant="grey"
            hideIcon
            onClick={() => {
              toast.show("First.");
              toast.show("Second.");
              toast.show("Third replaces the first.");
            }}
          >
            Three in a row
          </Button>
        </Specimen>
        <Specimen label="hold 1500ms then show">
          <Button
            variant="grey"
            hideIcon
            onClick={() => {
              toast.hold(1500);
              toast.show("Waited for the hold.");
            }}
          >
            Hold, then show
          </Button>
        </Specimen>
        <Specimen label="dismiss">
          <Button
            variant="grey"
            hideIcon
            onClick={() => {
              const id = toast.show("Gone in a second.", { ms: 10000 });
              setTimeout(() => toast.dismiss(id), 1000);
            }}
          >
            Show, then dismiss
          </Button>
        </Specimen>
      </>
    ),
  },
];

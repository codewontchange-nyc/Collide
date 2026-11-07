import { useState } from "react";
import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { Notice } from "./Notice";

function Dismissable() {
  const [open, setOpen] = useState(true);
  if (!open) {
    return (
      <button type="button" className="label-small secondary" onClick={() => setOpen(true)} style={{ borderBottom: "var(--border-width) solid currentColor" }}>
        Show it again
      </button>
    );
  }
  return (
    <Notice kind="success" title="Saved" onDismiss={() => setOpen(false)}>
      Your availability for next week is in.
    </Notice>
  );
}

export const entries: CatalogEntry[] = [
  {
    id: "notice",
    name: "Notice",
    group: "Feedback",
    tasks: ["tell the person something on the page", "over this month", "an error in a form", "a banner across the top", "something to act on"],
    variants: [
      "inline default",
      "inline success",
      "inline error",
      "inline title and body",
      "inline body only",
      "inline action",
      "inline action (href)",
      "inline onDismiss",
      "banner default",
      "banner success",
      "banner error",
    ],
    render: () => (
      <>
        <Specimen label="inline, default">
          <Notice>Three visits are queued for next week.</Notice>
        </Specimen>
        <Specimen label="inline, success">
          <Notice kind="success">Handled. Thank you.</Notice>
        </Specimen>
        <Specimen label="inline, error">
          <Notice kind="error" title="Over this month">
            Direct funds ran $120 past the budget. The pool covered it.
          </Notice>
        </Specimen>
        <Specimen label="inline, title and body">
          <Notice title="A fresh Colony is ready">The next open will pick it up.</Notice>
        </Specimen>
        <Specimen label="inline, body only">
          <Notice>Nothing needs you this week.</Notice>
        </Specimen>
        <Specimen label="inline, action">
          <Notice title="One request needs a pick" action={{ label: "Pick someone", onClick: () => undefined }}>
            Kitchen faucet drips.
          </Notice>
        </Specimen>
        <Specimen label="inline, action (href)">
          <Notice action={{ label: "Open budget", href: "/budget" }}>The pool rolled $340 forward.</Notice>
        </Specimen>
        <Specimen label="inline, onDismiss">
          <Dismissable />
        </Specimen>
        <Specimen label="banner, default">
          <Notice placement="banner">You are looking at the demo colony.</Notice>
        </Specimen>
        <Specimen label="banner, success">
          <Notice placement="banner" kind="success">
            Installed. Open Colony from your home screen.
          </Notice>
        </Specimen>
        <Specimen label="banner, error">
          <Notice placement="banner" kind="error" action={{ label: "Retry", onClick: () => undefined }}>
            Could not reach the colony. Showing what we had.
          </Notice>
        </Specimen>
      </>
    ),
  },
  {
    id: "notice-toast",
    name: "Notice toast",
    group: "Feedback",
    tasks: ["confirm something just happened", "booked", "saved", "copied", "an update is ready"],
    variants: ["toast default", "toast success", "toast error", "toast title", "toast action", "toast onDismiss (sticky)", "toast dark mode"],
    render: () => (
      <>
        <Specimen label="toast, default">
          <Notice placement="toast">Noted. We will handle it.</Notice>
        </Specimen>
        <Specimen label="toast, success">
          <Notice placement="toast" kind="success">
            Booked. We will let them know.
          </Notice>
        </Specimen>
        <Specimen label="toast, error">
          <Notice placement="toast" kind="error">
            That did not go through.
          </Notice>
        </Specimen>
        <Specimen label="toast, title">
          <Notice placement="toast" kind="success" title="Invite code copied">
            Send it to one neighbor.
          </Notice>
        </Specimen>
        <Specimen label="toast, action">
          <Notice placement="toast" action={{ label: "Undo", onClick: () => undefined }}>
            Marked done.
          </Notice>
        </Specimen>
        <Specimen label="toast, onDismiss (sticky)">
          <Notice placement="toast" action={{ label: "Update", onClick: () => undefined }} onDismiss={() => undefined}>
            A fresh Colony is ready.
          </Notice>
        </Specimen>
        <Specimen label="toast, dark mode (outline, no shadow)">
          <div data-mode="dark" style={{ padding: "var(--padding-med)", background: "var(--color-surface)", width: "100%" }}>
            <Notice placement="toast" kind="success">
              Saved.
            </Notice>
          </div>
        </Specimen>
      </>
    ),
  },
];

import { useState } from "react";
import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { EmptyState } from "./EmptyState";

function LiveQuery() {
  const [query, setQuery] = useState("hexagon");
  if (query === "") return <EmptyState title="Cleared" body="Type again to search." action={{ label: "Search hexagon", onClick: () => setQuery("hexagon") }} compact />;
  return <EmptyState query={query} onClear={() => setQuery("")} />;
}

export const entries: CatalogEntry[] = [
  {
    id: "empty-state",
    name: "EmptyState",
    group: "Feedback",
    tasks: ["nothing here yet", "no results", "no provider selected", "offer the first action", "clearLabel: the clear button's label (default Clear)"],
    variants: ["title and body", "body only (the mono sentence)", "action", "query and onClear (live)", "compact", "pattern", "action and onClear"],
    render: () => (
      <>
        <Specimen label="title and body">
          <EmptyState title="Nothing needs you this week" body="Colony is holding the week. Come back when something changes." />
        </Specimen>
        <Specimen label="body only (the mono sentence)">
          <EmptyState body="No provider selected." />
        </Specimen>
        <Specimen label="action">
          <EmptyState title="No one in the colony yet" body="Invite one neighbor and the rest follows." action={{ label: "Invite your tribe", href: "/start/2" }} />
        </Specimen>
        <Specimen label="query and onClear (live)">
          <LiveQuery />
        </Specimen>
        <Specimen label="compact">
          <EmptyState compact body="No visits scheduled." />
        </Specimen>
        <Specimen label="pattern">
          <EmptyState pattern="colony" title="Your colony is quiet" body="Nothing to hand off right now." compact />
        </Specimen>
        <Specimen label="action and onClear">
          <EmptyState query="plumbing" onClear={() => undefined} action={{ label: "Request something", onClick: () => undefined }} />
        </Specimen>
      </>
    ),
  },
];

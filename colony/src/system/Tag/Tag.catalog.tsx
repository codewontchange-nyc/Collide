import { useState } from "react";
import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { QuietButton } from "@/system/QuietButton/QuietButton";
import { Tag } from "./Tag";

function RemoveDemo() {
  const [skills, setSkills] = useState(["Plumbing", "Electrical", "Childcare"]);
  return (
    <>
      {skills.map((s) => (
        <Tag key={s} onRemove={() => setSkills((list) => list.filter((x) => x !== s))} removeLabel={`Remove ${s}`}>
          {s}
        </Tag>
      ))}
      {skills.length < 3 && <QuietButton onClick={() => setSkills(["Plumbing", "Electrical", "Childcare"])}>Reset</QuietButton>}
    </>
  );
}

export const entries: CatalogEntry[] = [
  {
    id: "tag",
    name: "Tag",
    group: "Marks and status",
    tasks: ["label a kind of thing", "name a skill", "mark a category", "show a state beside a label", "remove an item from a set"],
    variants: ["muted", "ink", "outlined", "state default", "state success", "state error", "state inactive", "href", "remove", "href and remove", "on a ground"],
    render: () => (
      <>
        <Specimen label="muted">
          <Tag>Plumbing</Tag>
        </Specimen>
        <Specimen label="ink">
          <Tag tone="ink">Smart matched</Tag>
        </Specimen>
        <Specimen label="outlined">
          <Tag tone="outlined">Trial</Tag>
        </Specimen>
        <Specimen label="state default">
          <Tag state="default">Queued</Tag>
        </Specimen>
        <Specimen label="state success">
          <Tag state="success">Scheduled</Tag>
          <Tag state="success" tone="outlined">
            Done
          </Tag>
        </Specimen>
        <Specimen label="state error">
          <Tag state="error">Past due</Tag>
        </Specimen>
        <Specimen label="state inactive">
          <Tag state="inactive">Off</Tag>
          <Tag state="inactive" tone="ink">
            Canceled
          </Tag>
        </Specimen>
        <Specimen label="href">
          <Tag href="/system">System</Tag>
          <Tag href="https://example.com" tone="outlined">
            Elsewhere
          </Tag>
        </Specimen>
        <Specimen label="remove">
          <RemoveDemo />
        </Specimen>
        <Specimen label="href and remove">
          <Tag href="/system" onRemove={() => undefined} removeLabel="Remove Kitchen">
            Kitchen
          </Tag>
        </Specimen>
        <Specimen label="on a ground" ground="ground">
          <Tag tone="outlined">Outlined</Tag>
          <Tag tone="ink">Ink</Tag>
          <Tag state="inactive" tone="outlined">
            Off
          </Tag>
        </Specimen>
      </>
    ),
  },
];

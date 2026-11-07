import { useState, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { useColonyState } from "@/store/store";
import { SheetContent, Button, Figure, Kicker, MetaLine, Mark, TextField, FilterChip, ChipRow, Panel, PanelHead, List, ListRow, toast, sheets, companion, appear, stag, useReducedMotion } from "@/system";
import { COPY } from "@/domain/copy";
import { WEEKDAY_SHORT } from "@/domain/dates";
import { DIRECT_SKILLS, INDIRECT_SKILLS, SKILL_LABEL, type Skill, type Weekday } from "@/domain/types";
import { bringProvider } from "@/store/actions";

export function InviteSheet() {
  const state = useColonyState();
  const code = state.colony.inviteCode;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Join ${state.colony.name} on Colony. Code ${code}`);
      toast.show(COPY.toast.invite);
    } catch {
      toast.show(`Your code is ${code}`);
    }
  };
  const share = async () => {
    const nav = navigator as Navigator & { share?: (d: { title: string; text: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: "Colony", text: `Join ${state.colony.name} on Colony. Code ${code}` });
        return;
      } catch {
        /* user dismissed */
      }
    }
    await copy();
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      void copy();
    }
  };
  return (
    <SheetContent
      eyebrow={<Kicker tone="meta">Invite</Kicker>}
      title="Grow the colony"
      description="Each new person adds their contribution. We match people who fit as the colony grows."
      actions={
        <>
          <Button variant="grey" hideIcon onClick={copy}>
            Copy code
          </Button>
          <Button onClick={share}>Share</Button>
        </>
      }
    >
      <div className="invite-band" role="button" tabIndex={0} aria-label="Copy invite code" onClick={copy} onKeyDown={onKey}>
        <Kicker>Invite code</Kicker>
        <Figure family="mono" size="md" value={code} />
      </div>
      <p className="sheet-note paragraph-x-small">More people, more homes, a deeper pool.</p>
    </SheetContent>
  );
}

const NAME_MAX = 12;
const DAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export function BringSheet() {
  const [name, setName] = useState("");
  const [skill, setSkill] = useState<Skill>("cleaning");
  const [rate, setRate] = useState("140");
  const [days, setDays] = useState<Weekday[]>([2]);
  const direct = DIRECT_SKILLS.includes(skill);
  const trimmed = name.trim();
  const shown = trimmed.length > NAME_MAX ? `${trimmed.slice(0, NAME_MAX)}…` : trimmed || "them";
  return (
    <SheetContent
      eyebrow={<Kicker tone="meta">Bring someone</Kicker>}
      title="Bring your current team"
      description="Already love someone? They stay yours. We just make it easier to pay and plan together."
      actions={
        <Button
          block
          hideIcon
          disabled={!trimmed}
          onClick={() => {
            bringProvider({ name: trimmed, skill, rateCents: Math.round((Number(rate) || 0) * 100), days });
            companion.say(COPY.toast.broughtIn);
            sheets.close();
          }}
        >
          Add {shown} to the colony
        </Button>
      }
    >
      <TextField label="Name" placeholder="Their name" autoCapitalize="words" value={name} onChange={setName} />
      <div className="sheet-form__group">
        <Kicker>What they do</Kicker>
        <ChipRow label="What they do">
          {[...DIRECT_SKILLS, ...INDIRECT_SKILLS].map((s) => (
            <FilterChip key={s} pressed={skill === s} onPress={() => setSkill(s)}>
              {SKILL_LABEL[s]}
            </FilterChip>
          ))}
        </ChipRow>
      </div>
      {direct && (
        <div className="sheet-form__group">
          <Kicker>Which days</Kicker>
          <ChipRow label="Which days">
            {DAYS.map((d) => (
              <FilterChip key={d} pressed={days.includes(d)} onPress={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}>
                {WEEKDAY_SHORT[d]}
              </FilterChip>
            ))}
          </ChipRow>
        </div>
      )}
      <TextField
        label={direct ? "Per visit, both homes" : "Per hour"}
        prefix="$"
        type="number"
        inputMode="decimal"
        min={0}
        step={5}
        value={rate}
        onChange={setRate}
        hint={direct ? "Direct funds, paid in full every month." : "Pool funded when you request them."}
      />
    </SheetContent>
  );
}

export function ManifestoSheet() {
  const state = useColonyState();
  const reduced = useReducedMotion();
  const members = state.people.length;
  const providers = state.providers.length;
  return (
    <SheetContent mode="dark" eyebrow={<MetaLine facts={[state.colony.name]} />} title="Everyone has a role">
      <Mark size="md" drawIn />
      <div className="manifesto-lines">
        {COPY.manifesto.map((line, i) => (
          <motion.p
            key={line}
            className="paragraph-large"
            variants={appear()}
            initial={reduced ? false : "hidden"}
            animate="show"
            custom={0}
            transition={reduced ? { duration: 0 } : { delay: i * stag.lg }}
          >
            {line}
          </motion.p>
        ))}
      </div>
      <Panel>
        <PanelHead title="Each one vital" meta={<MetaLine as="span" facts={[`${members} members`, `${providers} who show up`]} />} />
        <List rule="none" density="reading">
          {state.people.map((p) => (
            <ListRow key={p.id} title={p.name} trailing={<span className="manifesto-part label-small">{p.role === "steward" ? "Keeps the colony honest" : "Makes it possible"}</span>} />
          ))}
          {state.providers.map((p) => (
            <ListRow key={p.id} title={p.name} trailing={<span className="manifesto-role paragraph-x-small">{p.roleLine}.</span>} />
          ))}
        </List>
      </Panel>
    </SheetContent>
  );
}

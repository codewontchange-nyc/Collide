import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useColonyState } from "@/store/store";
import { useMaps } from "@/store/selectors";
import {
  SheetContent,
  Button,
  Avatar,
  Tag,
  StatusWord,
  SignalDot,
  MetaLine,
  Kicker,
  Figure,
  Card,
  List,
  ListRow,
  TextField,
  FilterChip,
  ChipRow,
  EmptyState,
  Loading,
  Companion,
  Rise,
  toast,
  sheets,
  companion,
  appear,
  dur,
  useReducedMotion,
} from "@/system";
import { COPY } from "@/domain/copy";
import { fmt } from "@/domain/money";
import { fmtDate } from "@/domain/dates";
import { poolBalance } from "@/domain/budget";
import { INDIRECT_SKILLS, SKILL_LABEL, type Skill, type Urgency } from "@/domain/types";
import { acceptMatch, declineMatch, requestNeed, runMatch } from "@/store/actions";

const URGENCIES: Urgency[] = ["whenever", "this_week", "soon", "urgent"];
const SUGGEST: Partial<Record<Skill, string[]>> = {
  plumbing: ["Kitchen faucet drips", "Slow bathroom drain", "Radiator valve hisses"],
  handyman: ["Hang the new shelves", "Fix the sticky back door", "Patch and paint the hallway"],
  electrical: ["Swap the dining light fixture", "Outlet by the sink stopped working"],
  hvac: ["Furnace tune-up before winter", "AC not cooling the bedroom"],
  pest: ["Quarterly pest visit", "Something is in the walls"],
  sewing: ["Hem two pairs of pants", "Repair the couch cushion zipper"],
  seasonal: ["Gutters before the leaves", "Swap the screens for storms"],
};
const CURATE_MS = 750;

export function RequestSheet({ homeId, category }: { homeId?: string; category?: string }) {
  const state = useColonyState();
  const reduced = useReducedMotion();
  const [skill, setSkill] = useState<Skill>((category as Skill) ?? "handyman");
  const [home, setHome] = useState(homeId ?? state.homes[0]?.id ?? "");
  const [urgency, setUrgency] = useState<Urgency>("this_week");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [curating, setCurating] = useState(false);
  const ideas = SUGGEST[skill] ?? [];
  const balance = poolBalance(state);

  const submit = () => {
    const t = title.trim() || ideas[0] || `${SKILL_LABEL[skill]} at home`;
    const needId = requestNeed({ title: t, note: note.trim(), category: skill, homeId: home, urgency });
    setCurating(true);
    companion.gather(CURATE_MS);
    setTimeout(() => {
      runMatch(needId);
      sheets.swap({ kind: "match", needId });
    }, CURATE_MS);
  };

  if (curating) {
    return (
      <SheetContent eyebrow={<Kicker tone="meta">One moment</Kicker>} dismissable={false}>
        <motion.div className="sheet-curating" variants={appear()} initial={reduced ? false : "hidden"} animate="show" custom={0} aria-live="polite">
          <Companion mood="gather" />
          <Loading kind="sentence">{COPY.curating}</Loading>
          <Loading kind="bar" once duration={CURATE_MS} label="Curating" />
        </motion.div>
      </SheetContent>
    );
  }

  return (
    <SheetContent
      eyebrow={<MetaLine facts={["Request something", `The pool has ${fmt(balance)}`]} />}
      title="What does the colony need?"
      actions={
        <Button block onClick={submit}>
          Find someone
        </Button>
      }
    >
      <div className="sheet-form">
        <div className="sheet-form__group">
          <Kicker>What kind</Kicker>
          <ChipRow label="What kind">
            {INDIRECT_SKILLS.map((s) => (
              <FilterChip key={s} pressed={skill === s} onPress={() => setSkill(s)}>
                {SKILL_LABEL[s]}
              </FilterChip>
            ))}
          </ChipRow>
        </div>
        <div className="sheet-form__group">
          <TextField label="What is it" placeholder={ideas[0] ?? "Tell us in a few words"} value={title} onChange={setTitle} />
          {ideas.length > 0 && (
            <ChipRow label="Suggestions">
              {ideas.map((i) => (
                <FilterChip key={i} momentary onPress={() => setTitle(i)}>
                  {i}
                </FilterChip>
              ))}
            </ChipRow>
          )}
        </div>
        <div className="sheet-form__group">
          <Kicker>Which home</Kicker>
          <ChipRow label="Which home">
            {state.homes.map((h) => (
              <FilterChip key={h.id} pressed={home === h.id} onPress={() => setHome(h.id)}>
                {h.label}
              </FilterChip>
            ))}
          </ChipRow>
        </div>
        <div className="sheet-form__group">
          <Kicker>How soon</Kicker>
          <ChipRow label="How soon">
            {URGENCIES.map((u) => (
              <FilterChip key={u} pressed={urgency === u} onPress={() => setUrgency(u)}>
                {COPY.urgencyLabel[u]}
              </FilterChip>
            ))}
          </ChipRow>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p key={urgency} className="sheet-form__hint paragraph-x-small" initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur.fast }}>
              {COPY.urgencyHint[urgency]}
            </motion.p>
          </AnimatePresence>
        </div>
        <TextField label="Anything we should know" rows={3} placeholder="Gate code, the dog's name, where the shutoff is" value={note} onChange={setNote} />
        <p className="sheet-note paragraph-x-small">{COPY.noCut}</p>
      </div>
    </SheetContent>
  );
}

export function MatchSheet({ needId }: { needId: string }) {
  const state = useColonyState();
  const maps = useMaps();
  const need = maps.needs.get(needId);
  const matches = state.matches.filter((m) => m.needId === needId && m.status !== "declined").sort((a, b) => b.score - a.score);
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    if (!picked && matches[0]) setPicked(matches[0].id);
  }, [matches, picked]);
  if (!need) return null;
  const accepted = matches.find((m) => m.status === "accepted");
  const balance = poolBalance(state);
  const chosen = matches.find((m) => m.id === picked) ?? matches[0];
  const chosenFirst = chosen ? maps.providers.get(chosen.providerId)?.name.split(" ")[0] : undefined;

  if (accepted) {
    const p = maps.providers.get(accepted.providerId);
    return (
      <SheetContent eyebrow={<Kicker tone="meta">Scheduled</Kicker>} title={need.title}>
        <List rule="none">
          <ListRow
            leading={<Avatar size="md" name={p?.name ?? ""} src={p?.avatar} />}
            title={p?.name ?? ""}
            facts={[fmtDate(accepted.earliest), `${fmt(accepted.quoteCents)} from the pool`]}
            trailing={<StatusWord state="success">Scheduled</StatusWord>}
          />
        </List>
        <p className="sheet-serif paragraph-medium">{COPY.handled}</p>
      </SheetContent>
    );
  }

  const notNow = (
    <Button
      variant="grey"
      hideIcon
      onClick={() => {
        matches.forEach((m) => declineMatch(m.id));
        toast.show(COPY.toast.matchDeclined);
        sheets.close();
      }}
    >
      Not now
    </Button>
  );

  return (
    <SheetContent
      eyebrow={<MetaLine facts={[need.title, maps.homes.get(need.homeId)?.label]} />}
      title="A few people who fit"
      actions={
        matches.length === 0 ? (
          notNow
        ) : (
          <>
            {notNow}
            <Button
              disabled={!chosen}
              onClick={() => {
                if (!chosen) return;
                acceptMatch(chosen.id);
                companion.say(COPY.handled);
                toast.show(COPY.toast.matchAccepted);
                sheets.close();
              }}
            >
              Book {chosenFirst ?? ""}
            </Button>
          </>
        )
      }
    >
      {matches.length === 0 && <EmptyState compact title="No one fits yet." body="We will keep curating and tap you when someone does." />}
      {matches.map((m, i) => {
        const p = maps.providers.get(m.providerId);
        if (!p) return null;
        const on = chosen?.id === m.id;
        const covers = m.quoteCents <= balance;
        return (
          <Rise key={m.id} index={i}>
            <Card pressed={on} onPress={() => setPicked(m.id)} className="match-card">
              <div className="match-card__lead">
                <Avatar size="md" name={p.name} src={p.avatar} />
                <div className="match-card__who">
                  <span className="headline-small">{p.name}</span>
                  <span className="match-card__role paragraph-x-small">{p.roleLine}.</span>
                </div>
                <div className="match-card__quote">
                  <Figure value={m.quoteCents} format={fmt} size="sm" />
                  <span className="match-card__when label-small">{fmtDate(m.earliest)}</span>
                </div>
              </div>
              <div className="ig-tags">
                {m.reasons.map((r) => (
                  <Tag key={r} tone="muted">
                    {r}
                  </Tag>
                ))}
              </div>
              {on && (
                <p className="match-cover paragraph-x-small">
                  <SignalDot state={covers ? "success" : "default"} />
                  <span>{covers ? `The pool covers it, ${fmt(balance - m.quoteCents)} stays.` : `The pool is ${fmt(m.quoteCents - balance)} short this month.`}</span>
                </p>
              )}
            </Card>
          </Rise>
        );
      })}
      <p className="sheet-note paragraph-x-small">Tips and bonuses stay between you. Colony takes no cut.</p>
    </SheetContent>
  );
}

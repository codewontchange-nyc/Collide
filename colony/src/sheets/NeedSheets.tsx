import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useColonyState } from "@/store/store";
import { useMaps } from "@/store/selectors";
import { Sheet } from "@/ui/Sheet";
import { Btn } from "@/ui/Btn";
import { Chip } from "@/ui/Chip";
import { Avatar } from "@/ui/Avatar";
import { Icon } from "@/ui/Icon";
import { toast } from "@/ui/Toast";
import { sheets } from "@/ui/sheetStore";
import { companion } from "@/brand/companion";
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

export function RequestSheet({ homeId, category }: { homeId?: string; category?: string }) {
  const state = useColonyState();
  const [skill, setSkill] = useState<Skill>((category as Skill) ?? "handyman");
  const [home, setHome] = useState(homeId ?? state.homes[0]?.id ?? "");
  const [urgency, setUrgency] = useState<Urgency>("this_week");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [curating, setCurating] = useState(false);
  const ideas = SUGGEST[skill] ?? [];

  const submit = () => {
    const t = title.trim() || ideas[0] || `${SKILL_LABEL[skill]} at home`;
    const needId = requestNeed({ title: t, note: note.trim(), category: skill, homeId: home, urgency });
    setCurating(true);
    companion.gather(900);
    setTimeout(() => {
      runMatch(needId);
      sheets.swap({ kind: "match", needId });
    }, 750);
  };

  if (curating)
    return (
      <Sheet kicker="One moment">
        <div className="empty" style={{ padding: "48px 0" }}>
          <motion.div initial={{ opacity: 0.4 }} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }}>
            <p className="voice">{COPY.curating}</p>
          </motion.div>
        </div>
      </Sheet>
    );

  return (
    <Sheet
      kicker="Request something"
      title="What does the colony need?"
      foot={
        <Btn variant="honey" block onClick={submit}>
          Find someone
        </Btn>
      }
    >
      <div className="chips" style={{ marginTop: 4 }}>
        {INDIRECT_SKILLS.map((s) => (
          <Chip key={s} on={skill === s} onClick={() => setSkill(s)}>
            {SKILL_LABEL[s]}
          </Chip>
        ))}
      </div>
      <label className="label" style={{ marginTop: 20 }}>
        What is it
      </label>
      <input className="field" placeholder={ideas[0] ?? "Tell us in a few words"} value={title} onChange={(e) => setTitle(e.target.value)} />
      {ideas.length > 0 && (
        <div className="chips" style={{ marginTop: 8 }}>
          {ideas.map((i) => (
            <Chip key={i} tone="line" onClick={() => setTitle(i)}>
              {i}
            </Chip>
          ))}
        </div>
      )}
      <label className="label" style={{ marginTop: 18 }}>
        Which home
      </label>
      <div className="chips">
        {state.homes.map((h) => (
          <Chip key={h.id} on={home === h.id} onClick={() => setHome(h.id)}>
            {h.label}
          </Chip>
        ))}
      </div>
      <label className="label" style={{ marginTop: 18 }}>
        How soon
      </label>
      <div className="chips">
        {URGENCIES.map((u) => (
          <Chip key={u} on={urgency === u} onClick={() => setUrgency(u)}>
            {COPY.urgencyLabel[u]}
          </Chip>
        ))}
      </div>
      <p className="tiny muted" style={{ marginTop: 6 }}>
        {COPY.urgencyHint[urgency]}
      </p>
      <label className="label" style={{ marginTop: 18 }}>
        Anything we should know
      </label>
      <textarea className="field" placeholder="Gate code, the dog's name, where the shutoff is" value={note} onChange={(e) => setNote(e.target.value)} />
      <p className="small muted" style={{ marginTop: 16 }}>
        The pool has {fmt(poolBalance(state))} to put toward this. {COPY.noCut}
      </p>
    </Sheet>
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
  const chosen = matches.find((m) => m.id === picked);

  if (accepted) {
    const p = maps.providers.get(accepted.providerId);
    return (
      <Sheet kicker="Scheduled" title={need.title}>
        <div className="row">
          <Avatar name={p?.name ?? ""} src={p?.avatar} size="lg" />
          <div className="grow">
            <div style={{ fontWeight: 400 }}>{p?.name}</div>
            <div className="small muted">
              {fmtDate(accepted.earliest)}, {fmt(accepted.quoteCents)} from the pool
            </div>
          </div>
        </div>
        <p className="voice" style={{ marginTop: 22 }}>
          {COPY.handled}
        </p>
      </Sheet>
    );
  }

  return (
    <Sheet
      kicker={`${need.title}, ${maps.homes.get(need.homeId)?.label}`}
      title="A few people who fit"
      foot={
        <>
          <Btn
            variant="ghost"
            onClick={() => {
              matches.forEach((m) => declineMatch(m.id));
              toast.show(COPY.toast.matchDeclined);
              sheets.close();
            }}
          >
            Not now
          </Btn>
          <Btn
            variant="honey"
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return;
              acceptMatch(chosen.id);
              companion.say(COPY.handled);
              toast.show(COPY.toast.matchAccepted);
              sheets.close();
            }}
          >
            Book {chosen ? maps.providers.get(chosen.providerId)?.name.split(" ")[0] : ""}
          </Btn>
        </>
      }
    >
      {matches.length === 0 && (
        <div className="empty">
          <p className="voice">No one fits yet.</p>
          <p className="small">We will keep curating and tap you when someone does.</p>
        </div>
      )}
      <div className="stack" style={{ marginTop: 4 }}>
        {matches.map((m, i) => {
          const p = maps.providers.get(m.providerId);
          if (!p) return null;
          const on = picked === m.id;
          return (
            <motion.button
              key={m.id}
              type="button"
              className={["card", on ? "" : "flat"].join(" ")}
              style={{ textAlign: "left", marginLeft: 0, border: on ? "1px solid var(--honey)" : "1px solid transparent" }}
              onClick={() => setPicked(m.id)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              aria-pressed={on}
            >
              <div className="row">
                <Avatar name={p.name} src={p.avatar} size="lg" />
                <div className="grow">
                  <div style={{ fontWeight: 400 }}>{p.name}</div>
                  <div className="small muted">
                    <em>{p.roleLine}</em>
                  </div>
                </div>
                <div className="right">
                  <div className="money">{fmt(m.quoteCents)}</div>
                  <div className="tiny muted">{fmtDate(m.earliest)}</div>
                </div>
              </div>
              <div className="chips" style={{ marginTop: 12 }}>
                {m.reasons.map((r) => (
                  <Chip key={r} tone={r.toLowerCase().includes("pool") ? "honey" : "paper"}>
                    {r}
                  </Chip>
                ))}
              </div>
              {on && (
                <p className="tiny muted" style={{ marginTop: 10 }}>
                  <Icon name="check" size={12} /> {m.quoteCents <= balance ? `The pool covers it, ${fmt(balance - m.quoteCents)} stays.` : `The pool is ${fmt(m.quoteCents - balance)} short this month.`}
                </p>
              )}
            </motion.button>
          );
        })}
      </div>
      <p className="small muted" style={{ marginTop: 18 }}>
        Tips and bonuses stay between you. Colony takes no cut.
      </p>
    </Sheet>
  );
}

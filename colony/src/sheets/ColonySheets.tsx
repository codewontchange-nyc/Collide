import { useState } from "react";
import { motion } from "motion/react";
import { useColonyState } from "@/store/store";
import { Sheet } from "@/ui/Sheet";
import { Btn } from "@/ui/Btn";
import { Chip } from "@/ui/Chip";
import { Mark } from "@/brand/Mark";
import { toast } from "@/ui/Toast";
import { sheets } from "@/ui/sheetStore";
import { companion } from "@/brand/companion";
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
  return (
    <Sheet
      kicker="Invite"
      title="Grow the colony"
      foot={
        <>
          <Btn variant="ghost" onClick={copy}>
            Copy code
          </Btn>
          <Btn variant="honey" onClick={share}>
            Share
          </Btn>
        </>
      }
    >
      <p className="sub">Adding members is easy. We curate and match people who fit your lifestyle as the colony grows.</p>
      <div className="card flat" style={{ marginTop: 18, textAlign: "center", padding: 28 }}>
        <div className="kicker" style={{ justifyContent: "center", marginLeft: 0 }}>
          Invite code
        </div>
        <div className="hero sm" style={{ marginLeft: 0, marginTop: 10, letterSpacing: "0.08em" }}>
          {code}
        </div>
      </div>
      <p className="tiny muted" style={{ marginTop: 16 }}>
        Each new person adds their contribution. More people, more homes, a deeper pool.
      </p>
    </Sheet>
  );
}

export function BringSheet() {
  const [name, setName] = useState("");
  const [skill, setSkill] = useState<Skill>("cleaning");
  const [rate, setRate] = useState(140);
  const [days, setDays] = useState<Weekday[]>([2]);
  const direct = DIRECT_SKILLS.includes(skill);
  return (
    <Sheet
      kicker="Bring someone"
      title="Bring your current team"
      foot={
        <Btn
          variant="honey"
          block
          disabled={!name.trim()}
          onClick={() => {
            bringProvider({ name: name.trim(), skill, rateCents: Math.round(rate * 100), days });
            companion.say(COPY.toast.broughtIn);
            sheets.close();
          }}
        >
          Add {name.trim() || "them"} to the colony
        </Btn>
      }
    >
      <p className="sub">Already love someone? They stay yours. We just make it easier to pay and plan together.</p>
      <label className="label" style={{ marginTop: 18 }}>
        Name
      </label>
      <input className="field" placeholder="Their name" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="label" style={{ marginTop: 16 }}>
        What they do
      </label>
      <div className="chips">
        {[...DIRECT_SKILLS, ...INDIRECT_SKILLS].map((s) => (
          <Chip key={s} on={skill === s} onClick={() => setSkill(s)}>
            {SKILL_LABEL[s]}
          </Chip>
        ))}
      </div>
      {direct && (
        <>
          <label className="label" style={{ marginTop: 16 }}>
            Which days
          </label>
          <div className="chips">
            {WEEKDAY_SHORT.map((d, i) => (
              <Chip key={d} on={days.includes(i as Weekday)} onClick={() => setDays(days.includes(i as Weekday) ? days.filter((x) => x !== i) : [...days, i as Weekday])}>
                {d}
              </Chip>
            ))}
          </div>
        </>
      )}
      <label className="label" style={{ marginTop: 16 }}>
        {direct ? "Per visit, both homes" : "Per hour"}
      </label>
      <input className="field" type="number" min={0} step={5} value={rate} onChange={(e) => setRate(Number(e.target.value))} style={{ width: 140 }} />
      <p className="tiny muted" style={{ marginTop: 16 }}>
        {direct ? "Direct funds, paid in full every month." : "Pool funded when you request them."}
      </p>
    </Sheet>
  );
}

export function ManifestoSheet() {
  const state = useColonyState();
  return (
    <Sheet kicker={state.colony.name} title="Everyone has a role">
      <div style={{ color: "var(--ink)", marginBottom: 8 }}>
        <Mark size={36} drawIn />
      </div>
      <div className="stack" style={{ gap: 18, marginTop: 8 }}>
        {COPY.manifesto.map((line, i) => (
          <motion.p key={line} className="voice" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.18, duration: 0.5 }}>
            {line}
          </motion.p>
        ))}
      </div>
      <div className="kicker" style={{ marginTop: 28, marginBottom: 8, marginLeft: 0 }}>
        Each one vital
      </div>
      <div className="list">
        {state.people.map((p) => (
          <div key={p.id} className="item">
            <div className="grow t">{p.name}</div>
            <span className="small muted">{p.role === "steward" ? "Keeps the colony honest" : "Makes it possible"}</span>
          </div>
        ))}
        {state.providers.map((p) => (
          <div key={p.id} className="item">
            <div className="grow t">{p.name}</div>
            <span className="small muted">
              <em>{p.roleLine}</em>
            </span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

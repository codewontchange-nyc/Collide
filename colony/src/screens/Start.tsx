import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Btn } from "@/ui/Btn";
import { Chip } from "@/ui/Chip";
import { Icon } from "@/ui/Icon";
import { Kicker } from "@/ui/PageHead";
import { Toggle } from "@/ui/Toggle";
import { Mark } from "@/brand/Mark";
import { toast } from "@/ui/Toast";
import { fmt } from "@/domain/money";
import { COPY } from "@/domain/copy";
import { DIRECT_SKILLS, SKILL_LABEL, type Skill, type Weekday } from "@/domain/types";
import { WEEKDAY_SHORT } from "@/domain/dates";
import { createColony, tourDemo } from "@/store/actions";

interface HouseholdDraft { name: string; address: string; area: string; people: string[] }
interface ProviderDraft { name: string; skill: Skill; rateCents: number; days: Weekday[] }

const STEPS = ["Create or join", "Invite your tribe", "Bring your team", "Set the budget"];

export function Start() {
  const nav = useNavigate();
  const { step: stepParam } = useParams();
  const step = Math.min(4, Math.max(1, Number(stepParam ?? 1)));

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [households, setHouseholds] = useState<HouseholdDraft[]>([
    { name: "", address: "", area: "", people: ["", ""] },
    { name: "", address: "", area: "", people: ["", ""] },
  ]);
  const [providers, setProviders] = useState<ProviderDraft[]>([]);
  const [matchUs, setMatchUs] = useState(true);
  const [perPerson, setPerPerson] = useState(100000);

  const peopleCount = households.reduce((a, h) => a + h.people.filter((p) => p.trim()).length, 0);
  const homesCount = households.filter((h) => h.people.some((p) => p.trim())).length;
  const total = peopleCount * perPerson;

  const go = (n: number) => nav(`/start/${n}`);

  const finish = () => {
    createColony({
      name: name.trim() || "Our colony",
      contributionCents: perPerson,
      households: households
        .filter((h) => h.people.some((p) => p.trim()))
        .map((h, i) => ({
          name: h.name.trim() || h.address.trim() || `Household ${i + 1}`,
          address: h.address.trim() || `Home ${i + 1}`,
          area: h.area.trim() || "Brooklyn",
          people: h.people.map((p) => p.trim()).filter(Boolean),
        })),
      providers: matchUs ? [] : providers.filter((p) => p.name.trim()),
    });
    toast.show("Your colony is ready. We are curating your first matches.", { ms: 3600 });
    nav("/", { replace: true });
  };

  const join = () => {
    if (code.trim().toUpperCase() === "HIVE-4821") {
      tourDemo();
      toast.show("Welcome to Dekalb & Bergen.");
      nav("/", { replace: true });
    } else toast.show("We do not know that code yet.");
  };

  return (
    <main className="screen bare" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <div className="row between" style={{ marginBottom: 28 }}>
        <button type="button" className="iconbtn" style={{ marginLeft: -10 }} onClick={() => (step === 1 ? nav("/welcome") : go(step - 1))} aria-label="Back">
          <Icon name="back" />
        </button>
        <div className="dots" aria-label={`Step ${step} of 4`}>
          {STEPS.map((_, i) => (
            <i key={i} className={i + 1 === step ? "on" : ""} />
          ))}
        </div>
        <Mark size={28} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} className="grow" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
          <Kicker>
            Step {step} of 4, {STEPS[step - 1]}
          </Kicker>

          {step === 1 && (
            <div style={{ marginTop: 14 }}>
              <h1>Name your colony</h1>
              <p className="sub" style={{ marginTop: 10 }}>
                Build it however you want, with whatever tribe you bring.
              </p>
              <label className="label" style={{ marginTop: 28 }}>
                Colony name
              </label>
              <input className="field" placeholder="Dekalb & Bergen" value={name} onChange={(e) => setName(e.target.value)} />
              <hr className="hr" />
              <label className="label">I have an invite code</label>
              <div className="row">
                <input className="field grow" placeholder="HIVE-4821" value={code} onChange={(e) => setCode(e.target.value)} style={{ textTransform: "uppercase" }} />
                <Btn variant="ghost" onClick={join}>
                  Join
                </Btn>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ marginTop: 14 }}>
              <h1>Invite your tribe</h1>
              <p className="sub" style={{ marginTop: 10 }}>
                Colonies start at 4 people, usually 2 households.
              </p>
              <div className="stack" style={{ marginTop: 24 }}>
                {households.map((h, i) => (
                  <div key={i} className="card flat">
                    <div className="row between" style={{ marginBottom: 10 }}>
                      <strong>Household {i + 1}</strong>
                      {households.length > 1 && (
                        <button type="button" className="btn text sm" onClick={() => setHouseholds(households.filter((_, j) => j !== i))}>
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="stack" style={{ gap: 8 }}>
                      <input className="field" placeholder="Street, like Dekalb Ave" value={h.address} onChange={(e) => setHouseholds(households.map((x, j) => (j === i ? { ...x, address: e.target.value } : x)))} />
                      <input className="field" placeholder="Neighborhood" value={h.area} onChange={(e) => setHouseholds(households.map((x, j) => (j === i ? { ...x, area: e.target.value } : x)))} />
                      {h.people.map((p, k) => (
                        <input key={k} className="field" placeholder={k === 0 ? "You, or the first person" : "Second person"} value={p} onChange={(e) => setHouseholds(households.map((x, j) => (j === i ? { ...x, people: x.people.map((y, l) => (l === k ? e.target.value : y)) } : x)))} />
                      ))}
                      <button type="button" className="btn text sm" style={{ alignSelf: "flex-start", marginLeft: -10 }} onClick={() => setHouseholds(households.map((x, j) => (j === i ? { ...x, people: [...x.people, ""] } : x)))}>
                        Add a person
                      </button>
                    </div>
                  </div>
                ))}
                <Btn variant="ghost" onClick={() => setHouseholds([...households, { name: "", address: "", area: "", people: ["", ""] }])}>
                  Add a household
                </Btn>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ marginTop: 14 }}>
              <h1>Bring your current team</h1>
              <p className="sub" style={{ marginTop: 10 }}>
                Already love your cleaner or your chef? Bring them. They stay yours, we just make it easier to pay and plan together.
              </p>
              <div className="item" style={{ marginTop: 16 }}>
                <div className="grow">
                  <div className="t">Colony will match us</div>
                  <div className="m">We curate people who fit your lifestyle as the colony grows.</div>
                </div>
                <Toggle on={matchUs} onChange={setMatchUs} label="Colony will match us" />
              </div>
              {!matchUs && (
                <div className="stack" style={{ marginTop: 16 }}>
                  {providers.map((p, i) => (
                    <div key={i} className="card flat stack" style={{ gap: 8 }}>
                      <input className="field" placeholder="Name" value={p.name} onChange={(e) => setProviders(providers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                      <div className="chips">
                        {DIRECT_SKILLS.map((s) => (
                          <Chip key={s} on={p.skill === s} onClick={() => setProviders(providers.map((x, j) => (j === i ? { ...x, skill: s } : x)))}>
                            {SKILL_LABEL[s]}
                          </Chip>
                        ))}
                      </div>
                      <div className="chips">
                        {WEEKDAY_SHORT.map((d, di) => (
                          <Chip key={d} on={p.days.includes(di as Weekday)} onClick={() => setProviders(providers.map((x, j) => (j === i ? { ...x, days: x.days.includes(di as Weekday) ? x.days.filter((y) => y !== di) : [...x.days, di as Weekday] } : x)))}>
                            {d}
                          </Chip>
                        ))}
                      </div>
                      <div className="row">
                        <span className="small muted">Per visit</span>
                        <input className="field" type="number" min={0} step={5} value={p.rateCents / 100} onChange={(e) => setProviders(providers.map((x, j) => (j === i ? { ...x, rateCents: Math.round(Number(e.target.value) * 100) } : x)))} style={{ width: 120 }} />
                      </div>
                    </div>
                  ))}
                  <Btn variant="ghost" onClick={() => setProviders([...providers, { name: "", skill: "cleaning", rateCents: 14000, days: [2] }])}>
                    Add someone you already use
                  </Btn>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div style={{ marginTop: 14 }}>
              <h1>Set the budget</h1>
              <p className="sub" style={{ marginTop: 10 }}>
                We suggest $1,000 a person. That is $2,000 a couple and a long way for two homes.
              </p>
              <div className="row between" style={{ marginTop: 28 }}>
                <span className="label" style={{ margin: 0 }}>
                  Per person, a month
                </span>
                <div className="stepper">
                  <button type="button" onClick={() => setPerPerson(Math.max(25000, perPerson - 25000))} aria-label="Less">
                    -
                  </button>
                  <span className="money lg tnum">{fmt(perPerson)}</span>
                  <button type="button" onClick={() => setPerPerson(perPerson + 25000)} aria-label="More">
                    +
                  </button>
                </div>
              </div>
              <div className="hero" style={{ marginTop: 32 }}>
                {fmt(total)}
                <span className="unit">a month</span>
              </div>
              <p className="sub" style={{ marginTop: 8 }}>
                {peopleCount || 4} people, {homesCount || 2} homes.
              </p>
              <p className="voice" style={{ marginTop: 28 }}>
                {COPY.promise}
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="stack" style={{ marginTop: 28 }}>
        {step < 4 ? (
          <Btn block onClick={() => go(step + 1)}>
            Continue
          </Btn>
        ) : (
          <Btn variant="honey" block onClick={finish}>
            Create {name.trim() || "our colony"}
          </Btn>
        )}
      </div>
    </main>
  );
}

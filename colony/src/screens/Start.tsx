import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import type { Variants } from "motion/react";
import { Screen, PageIntro, IconButton, MetaLine, Mark, Steps, TextField, Kicker, QuietButton, Button, Card, Switch, ChipRow, FilterChip, NumberStepper, StatTile, Figure, Quote, toast, appear, dist, useReducedMotion } from "@/system";
import { fmt } from "@/domain/money";
import { COPY } from "@/domain/copy";
import { DIRECT_SKILLS, SKILL_LABEL, type Skill, type Weekday } from "@/domain/types";
import { WEEKDAY_SHORT } from "@/domain/dates";
import { createColony, tourDemo } from "@/store/actions";
import "./Start.css";

interface HouseholdDraft { name: string; address: string; area: string; people: string[] }
interface ProviderDraft { name: string; skill: Skill; rateCents: number; days: Weekday[] }

const STEPS = ["CREATE OR JOIN", "INVITE YOUR TRIBE", "BRING YOUR TEAM", "SET THE BUDGET"];
const TITLES = ["Name your colony", "Invite your tribe", "Bring your current team", "Set the budget"];
const LEDES = [
  "Build it however you want, with whatever tribe you bring.",
  "Colonies start at 4 people, usually 2 households.",
  "Already love your cleaner or your chef? Bring them. They stay yours, we just make it easier to pay and plan together.",
  "We suggest $1,000 a person. That is $2,000 a couple and a long way for two homes.",
];
/* Monday first, as a week reads on a calendar; the index is the engine's weekday (0 is Sunday). */
const DAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
const pad = (n: number) => String(n).padStart(2, "0");

const still: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
};

/** Start: four steps in one frame. The trail, the 4px track, a one tone title (an instruction), the step's groups, then the footer. */
export function Start() {
  const nav = useNavigate();
  const { step: stepParam } = useParams();
  const step = Math.min(4, Math.max(1, Number(stepParam ?? 1)));
  const reduced = useReducedMotion();

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
  const total = (peopleCount || 4) * perPerson;   /* the hero reads with its caption: four people until names are in */

  const go = (n: number) => nav(`/start/${n}`);
  const patchHousehold = (i: number, patch: Partial<HouseholdDraft>) => setHouseholds(households.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const patchProvider = (i: number, patch: Partial<ProviderDraft>) => setProviders(providers.map((x, j) => (j === i ? { ...x, ...patch } : x)));

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
    <Screen bare title="Start" className="start" restoreScroll={false}>
      <div className="start__head">
        <div className="start__trail">
          <IconButton icon="chevron-left" label="Back" onClick={() => (step === 1 ? nav("/welcome") : go(step - 1))} />
          <MetaLine facts={[`STEP ${step} OF 4`, STEPS[step - 1]]} />
          <Mark size="sm" className="start__mark" />
        </div>
        <Steps count={4} current={step} variant="track" />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} className="start__step" variants={reduced ? still : appear(undefined, dist.md)} initial="hidden" animate="show" exit="exit">
          <PageIntro title={TITLES[step - 1]} intro={LEDES[step - 1]} />

          {step === 1 && (
            <div className="start__groups">
              <TextField label="Colony name" placeholder="Dekalb & Bergen" autoCapitalize="words" value={name} onChange={setName} />
              <div className="start__group">
                <Kicker>I HAVE AN INVITE CODE</Kicker>
                <TextField
                  label="Code"
                  placeholder="HIVE-4821"
                  autoCapitalize="characters"
                  className="start__code"
                  value={code}
                  onChange={setCode}
                  suffix={
                    <QuietButton tone="ink" onClick={join}>
                      JOIN
                    </QuietButton>
                  }
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="start__groups">
              <div className="start__cards">
                {households.map((h, i) => (
                  <Card key={i} ground="ground">
                    <div className="start__card-head">
                      <Kicker>HOUSEHOLD {pad(i + 1)}</Kicker>
                      {households.length > 1 && <QuietButton onClick={() => setHouseholds(households.filter((_, j) => j !== i))}>REMOVE</QuietButton>}
                    </div>
                    <TextField label="Street" placeholder="Street, like Dekalb Ave" value={h.address} onChange={(v) => patchHousehold(i, { address: v })} />
                    <TextField label="Neighborhood" placeholder="Clinton Hill" value={h.area} onChange={(v) => patchHousehold(i, { area: v })} />
                    {h.people.map((p, k) => (
                      <TextField
                        key={k}
                        label={`Person ${pad(k + 1)}`}
                        placeholder={k === 0 ? "You, or the first person" : "Second person"}
                        value={p}
                        onChange={(v) => patchHousehold(i, { people: h.people.map((y, l) => (l === k ? v : y)) })}
                      />
                    ))}
                    <div>
                      <QuietButton onClick={() => patchHousehold(i, { people: [...h.people, ""] })}>ADD A PERSON</QuietButton>
                    </div>
                  </Card>
                ))}
              </div>
              <Button variant="outlined" hideIcon block onClick={() => setHouseholds([...households, { name: "", address: "", area: "", people: ["", ""] }])}>
                Add a household
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="start__groups">
              <Switch label="Colony will match us" hint="We curate people who fit your lifestyle as the colony grows." checked={matchUs} onChange={setMatchUs} />
              {!matchUs && (
                <>
                  <div className="start__cards">
                    {providers.map((p, i) => (
                      <Card key={i} ground="ground">
                        <TextField label="Name" placeholder="Their name" value={p.name} onChange={(v) => patchProvider(i, { name: v })} />
                        <div className="start__group start__group--tight">
                          <Kicker>WHAT THEY DO</Kicker>
                          <ChipRow label="What they do">
                            {DIRECT_SKILLS.map((s) => (
                              <FilterChip key={s} pressed={p.skill === s} onPress={() => patchProvider(i, { skill: s })}>
                                {SKILL_LABEL[s]}
                              </FilterChip>
                            ))}
                          </ChipRow>
                        </div>
                        <div className="start__group start__group--tight">
                          <Kicker>WHICH DAYS</Kicker>
                          <ChipRow label="Which days">
                            {DAYS.map((d) => (
                              <FilterChip
                                key={d}
                                pressed={p.days.includes(d)}
                                onPress={() => patchProvider(i, { days: p.days.includes(d) ? p.days.filter((y) => y !== d) : [...p.days, d] })}
                              >
                                {WEEKDAY_SHORT[d]}
                              </FilterChip>
                            ))}
                          </ChipRow>
                        </div>
                        <TextField
                          label="Per visit"
                          prefix="$"
                          type="number"
                          inputMode="decimal"
                          step={5}
                          min={0}
                          value={String(p.rateCents / 100)}
                          onChange={(v) => patchProvider(i, { rateCents: Math.round(Number(v) * 100) })}
                        />
                      </Card>
                    ))}
                  </div>
                  <Button variant="outlined" hideIcon block onClick={() => setProviders([...providers, { name: "", skill: "cleaning", rateCents: 14000, days: [2] }])}>
                    Add someone you already use
                  </Button>
                </>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="start__groups">
              <div className="start__amount">
                <Kicker>PER PERSON, A MONTH</Kicker>
                <NumberStepper value={perPerson} onChange={setPerPerson} step={25000} min={25000} format={fmt} label="Per person, a month" decrementLabel="Less" incrementLabel="More" />
              </div>
              <div className="start__group start__group--tight">
                <dl>
                  <StatTile label="All together" value={<Figure value={total} format={fmt} size="lg" countUp />} unit="A MONTH" />
                </dl>
                <p className="paragraph-x-small secondary">
                  {peopleCount || 4} people, {homesCount || 2} homes.
                </p>
              </div>
              <Quote>{COPY.promise}</Quote>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="start__foot">
        {step < 4 ? (
          <Button block onClick={() => go(step + 1)}>
            Continue
          </Button>
        ) : (
          <Button block onClick={finish}>
            Create {name.trim() || "our colony"}
          </Button>
        )}
      </div>
    </Screen>
  );
}

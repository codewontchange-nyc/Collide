import { useColonyState } from "@/store/store";
import { useMaps } from "@/store/selectors";
import { Sheet } from "@/ui/Sheet";
import { Btn } from "@/ui/Btn";
import { Avatar } from "@/ui/Avatar";
import { Chip } from "@/ui/Chip";
import { Stamp } from "@/ui/Stamp";
import { toast } from "@/ui/Toast";
import { sheets } from "@/ui/sheetStore";
import { companion } from "@/brand/companion";
import { fmtDate, fmtTime, monthOf } from "@/domain/dates";
import { fmt } from "@/domain/money";
import { cadenceLabel, occurrences } from "@/domain/cadence";
import { COPY } from "@/domain/copy";
import { SKILL_LABEL } from "@/domain/types";
import { markVisitDone, setTaskStatus } from "@/store/actions";

export function MealSheet({ id }: { id: string }) {
  const state = useColonyState();
  const maps = useMaps();
  const meal = state.meals.find((m) => m.id === id);
  if (!meal) return null;
  const chef = maps.providers.get(meal.chefId);
  const idx = state.meals.filter((m) => monthOf(m.date) === monthOf(meal.date)).sort((a, b) => a.date.localeCompare(b.date)).findIndex((m) => m.id === meal.id) + 1;
  return (
    <Sheet kicker={`Dinner ${idx} of 28, ${fmtDate(meal.date)}`} title={meal.title}>
      <div className="row" style={{ marginTop: 6 }}>
        <Avatar name={chef?.name ?? ""} src={chef?.avatar} />
        <div className="grow">
          <div style={{ fontWeight: 400 }}>{chef?.name}</div>
          <div className="small muted">{meal.cuisine}</div>
        </div>
        {meal.status === "served" && <Stamp animate={false}>Served</Stamp>}
      </div>
      <div className="chips" style={{ marginTop: 16 }}>
        {meal.tags.map((t) => (
          <Chip key={t}>{t}</Chip>
        ))}
        {meal.homeIds.map((h) => (
          <Chip key={h} tone="line">
            {maps.homes.get(h)?.label}
          </Chip>
        ))}
      </div>
      {idx === 28 && (
        <p className="voice" style={{ marginTop: 22 }}>
          {COPY.meal28}
        </p>
      )}
      <p className="small muted" style={{ marginTop: 20 }}>
        Cooked on {fmtDate(state.schedule.find((s) => s.id === meal.scheduleItemId)?.date ?? meal.date)}. Kept in the fridge, labeled, ready to warm.
      </p>
    </Sheet>
  );
}

export function VisitSheet({ id }: { id: string }) {
  const state = useColonyState();
  const maps = useMaps();
  const item = state.schedule.find((s) => s.id === id);
  if (!item) return null;
  const p = maps.providers.get(item.providerId);
  const home = maps.homes.get(item.homeId);
  const eng = item.engagementId ? maps.engagements.get(item.engagementId) : undefined;
  const meals = state.meals.filter((m) => m.scheduleItemId === item.id);
  return (
    <Sheet
      kicker={`${item.date === state.meta.simToday ? "Today" : fmtDate(item.date)}, ${fmtTime(item.start)} to ${fmtTime(item.end)}`}
      title={item.title}
      foot={
        item.status === "planned" ? (
          <Btn
            block
            onClick={() => {
              markVisitDone(item.id);
              companion.nod();
              toast.show(COPY.toast.visitDone);
              sheets.close();
            }}
          >
            Mark done
          </Btn>
        ) : undefined
      }
    >
      <button type="button" className="row" style={{ marginTop: 6, textAlign: "left" }} onClick={() => p && sheets.swap({ kind: "provider", id: p.id })}>
        <Avatar name={p?.name ?? ""} src={p?.avatar} size="lg" />
        <div className="grow">
          <div style={{ fontWeight: 400 }}>{p?.name}</div>
          <div className="small muted">
            <em>{p?.roleLine}</em>
          </div>
        </div>
        {item.status === "done" && <Stamp animate={false}>Done</Stamp>}
      </button>
      <div className="list" style={{ marginTop: 16 }}>
        <div className="item">
          <div className="grow">
            <div className="t">{home?.label}</div>
            <div className="m">{home?.address}</div>
          </div>
        </div>
        {eng && (
          <div className="item">
            <div className="grow">
              <div className="t">{eng.label}</div>
              <div className="m">
                {cadenceLabel(eng.cadence)}, {fmt(eng.costCents)} a visit
              </div>
            </div>
          </div>
        )}
      </div>
      {meals.length > 0 && (
        <>
          <div className="kicker" style={{ marginTop: 22, marginBottom: 10, marginLeft: 0 }}>
            Dinners from this visit
          </div>
          <div className="list">
            {meals.map((m) => (
              <button key={m.id} type="button" className="item press" onClick={() => sheets.swap({ kind: "meal", id: m.id })}>
                <span className="small muted tnum" style={{ width: 44 }}>
                  {fmtDate(m.date).split(",")[0]}
                </span>
                <div className="grow t ellipsis">{m.title}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

export function TaskSheet({ id }: { id: string }) {
  const state = useColonyState();
  const maps = useMaps();
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return null;
  const p = task.handledBy ? maps.providers.get(task.handledBy) : undefined;
  const home = task.homeId ? maps.homes.get(task.homeId) : undefined;
  const need = task.needId ? maps.needs.get(task.needId) : undefined;
  const foot =
    task.status === "needs_you" ? (
      <>
        <Btn
          variant="ghost"
          onClick={() => {
            setTaskStatus(task.id, "queued");
            toast.show("No rush. We will keep it in the queue.");
            sheets.close();
          }}
        >
          Later
        </Btn>
        <Btn
          variant="honey"
          onClick={() => {
            setTaskStatus(task.id, "scheduled");
            companion.say(COPY.handled);
            sheets.close();
          }}
        >
          Approve {fmtDate(task.dueOn).split(",")[0]}
        </Btn>
      </>
    ) : task.status === "queued" ? (
      <Btn
        block
        onClick={() => {
          sheets.swap({ kind: "request", homeId: task.homeId, category: task.category });
        }}
      >
        Find someone now
      </Btn>
    ) : task.status === "scheduled" ? (
      <Btn
        block
        onClick={() => {
          setTaskStatus(task.id, "handled");
          companion.nod();
          toast.show("Handled. Thank you.");
          sheets.close();
        }}
      >
        Mark handled
      </Btn>
    ) : undefined;
  return (
    <Sheet kicker={`${COPY.taskStatusLabel[task.status]}, ${fmtDate(task.dueOn)}`} title={task.title} foot={foot}>
      <div className="chips" style={{ marginTop: 4 }}>
        <Chip tone="line">{SKILL_LABEL[task.category]}</Chip>
        {home && <Chip tone="line">{home.label}</Chip>}
        <Chip>{task.source === "seasonal" ? "Seasonal" : task.source === "maintenance" ? "Preventative" : task.source === "match" ? "Smart matched" : "Added by a member"}</Chip>
      </div>
      {task.note && (
        <p className="sub" style={{ marginTop: 16 }}>
          {task.note}
        </p>
      )}
      {need && (
        <p className="small muted" style={{ marginTop: 12 }}>
          From your request: {need.title}
        </p>
      )}
      <div className="list" style={{ marginTop: 16 }}>
        {p ? (
          <button type="button" className="item press" onClick={() => sheets.swap({ kind: "provider", id: p.id })}>
            <Avatar name={p.name} src={p.avatar} />
            <div className="grow">
              <div className="t">{p.name}</div>
              <div className="m">
                <em>{p.roleLine}</em>
              </div>
            </div>
          </button>
        ) : (
          <div className="item">
            <div className="m">{task.status === "queued" ? "Waiting for the right person and the right month." : "Colony will assign someone."}</div>
          </div>
        )}
      </div>
      {task.status === "handled" && (
        <div style={{ marginTop: 20 }}>
          <Stamp animate={false} />
        </div>
      )}
    </Sheet>
  );
}

export function AllocationSheet({ engagementId }: { engagementId: string }) {
  const state = useColonyState();
  const maps = useMaps();
  const eng = maps.engagements.get(engagementId);
  if (!eng) return null;
  const p = maps.providers.get(eng.providerId);
  const month = monthOf(state.meta.simToday);
  const dates = occurrences(eng.cadence, month, eng.startsOn);
  const siblings = state.engagements.filter((e) => e.providerId === eng.providerId && e.id !== eng.id);
  return (
    <Sheet kicker="Direct funds" title={p?.name}>
      <button type="button" className="row" style={{ textAlign: "left", marginTop: 4 }} onClick={() => p && sheets.swap({ kind: "provider", id: p.id })}>
        <Avatar name={p?.name ?? ""} src={p?.avatar} size="lg" />
        <div className="grow">
          <div className="small muted">
            <em>{p?.roleLine}</em>
          </div>
        </div>
      </button>
      {[eng, ...siblings].map((e) => {
        const d = occurrences(e.cadence, month, e.startsOn);
        return (
          <div key={e.id} className="card flat" style={{ marginTop: 14 }}>
            <div className="row between">
              <div>
                <div style={{ fontWeight: 400 }}>{e.label}</div>
                <div className="small muted">
                  {cadenceLabel(e.cadence)}, {e.homeIds.map((h) => maps.homes.get(h)?.label).join(" and ")}
                </div>
              </div>
              <div className="right">
                <div className="money">{fmt(e.costCents * d.length)}</div>
                <div className="tiny muted">
                  {d.length} x {fmt(e.costCents)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div className="chips" style={{ marginTop: 16 }}>
        {dates.map((d) => (
          <Chip key={d} tone="line">
            {fmtDate(d).replace(", ", " ")}
          </Chip>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 18 }}>
        {COPY.noCut} Bonuses and tips go straight to {p?.name.split(" ")[0]}.
      </p>
    </Sheet>
  );
}

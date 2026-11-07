import { useColonyState } from "@/store/store";
import { useMaps } from "@/store/selectors";
import { SheetContent, Button, Avatar, Tag, StatusWord, MetaLine, Facts, Figure, Panel, PanelHead, List, ListRow, toast, sheets, companion } from "@/system";
import { fmtDate, fmtMonth, fmtTime, monthOf } from "@/domain/dates";
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
  const cooked = state.schedule.find((s) => s.id === meal.scheduleItemId)?.date ?? meal.date;
  return (
    <SheetContent eyebrow={<MetaLine facts={[`Dinner ${idx} of 28`, fmtDate(meal.date)]} />} title={meal.title}>
      <List rule="none">
        <ListRow
          leading={<Avatar size="md" name={chef?.name ?? ""} src={chef?.avatar} />}
          title={chef?.name ?? ""}
          facts={[meal.cuisine]}
          trailing={meal.status === "served" ? <StatusWord state="success">Served</StatusWord> : undefined}
        />
      </List>
      <div className="ig-tags">
        {meal.tags.map((t) => (
          <Tag key={t} tone="muted">
            {t}
          </Tag>
        ))}
        {meal.homeIds.map((h) => (
          <Tag key={h} tone="outlined">
            {maps.homes.get(h)?.label}
          </Tag>
        ))}
      </div>
      {idx === 28 && <p className="sheet-serif paragraph-medium">{COPY.meal28}</p>}
      <p className="sheet-note paragraph-x-small">Cooked on {fmtDate(cooked)}. Kept in the fridge, labeled, ready to warm.</p>
    </SheetContent>
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
  const when = item.date === state.meta.simToday ? "Today" : fmtDate(item.date);
  return (
    <SheetContent
      eyebrow={<MetaLine facts={[when, `${fmtTime(item.start)} to ${fmtTime(item.end)}`]} />}
      title={item.title}
      actions={
        item.status === "planned" ? (
          <Button
            block
            hideIcon
            onClick={() => {
              markVisitDone(item.id);
              companion.nod();
              toast.show(COPY.toast.visitDone);
              sheets.close();
            }}
          >
            Mark done
          </Button>
        ) : undefined
      }
    >
      <List rule="none">
        <ListRow
          leading={<Avatar size="md" name={p?.name ?? ""} src={p?.avatar} />}
          title={p?.name ?? ""}
          facts={p ? `${p.roleLine}.` : undefined}
          trailing={item.status === "done" ? <StatusWord state="success">Done</StatusWord> : undefined}
          chevron={item.status !== "done"}
          onPress={() => p && sheets.swap({ kind: "provider", id: p.id })}
        />
      </List>
      <Facts
        items={[
          home && { label: home.label, value: home.address },
          eng && { label: eng.label, value: `${cadenceLabel(eng.cadence)}, ${fmt(eng.costCents)} a visit` },
        ]}
      />
      {meals.length > 0 && (
        <Panel>
          <PanelHead title="Dinners from this visit" />
          <List rule="none">
            {meals.map((m) => (
              <ListRow key={m.id} index={fmtDate(m.date).split(",")[0]} indexWidth="3ch" title={m.title} ellipsis chevron onPress={() => sheets.swap({ kind: "meal", id: m.id })} />
            ))}
          </List>
        </Panel>
      )}
    </SheetContent>
  );
}

const SOURCE_LABEL = { seasonal: "Seasonal", maintenance: "Preventative", match: "Smart matched" } as const;

export function TaskSheet({ id }: { id: string }) {
  const state = useColonyState();
  const maps = useMaps();
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return null;
  const p = task.handledBy ? maps.providers.get(task.handledBy) : undefined;
  const home = task.homeId ? maps.homes.get(task.homeId) : undefined;
  const need = task.needId ? maps.needs.get(task.needId) : undefined;
  const source = task.source in SOURCE_LABEL ? SOURCE_LABEL[task.source as keyof typeof SOURCE_LABEL] : "Added by a member";
  const dotState = task.status === "handled" || task.status === "scheduled" ? "success" : "default";
  const actions =
    task.status === "needs_you" ? (
      <>
        <Button
          variant="grey"
          hideIcon
          onClick={() => {
            setTaskStatus(task.id, "queued");
            toast.show("No rush. We will keep it in the queue.");
            sheets.close();
          }}
        >
          Later
        </Button>
        <Button
          hideIcon
          onClick={() => {
            setTaskStatus(task.id, "scheduled");
            companion.say(COPY.handled);
            sheets.close();
          }}
        >
          Approve {fmtDate(task.dueOn).split(",")[0]}
        </Button>
      </>
    ) : task.status === "queued" ? (
      <Button block onClick={() => sheets.swap({ kind: "request", homeId: task.homeId, category: task.category })}>
        Find someone now
      </Button>
    ) : task.status === "scheduled" ? (
      <Button
        block
        hideIcon
        onClick={() => {
          setTaskStatus(task.id, "handled");
          companion.nod();
          toast.show("Handled. Thank you.");
          sheets.close();
        }}
      >
        Mark handled
      </Button>
    ) : undefined;
  return (
    <SheetContent
      eyebrow={
        <MetaLine
          facts={[
            <StatusWord key="status" state={dotState} pulse={task.status === "needs_you"}>
              {COPY.taskStatusLabel[task.status]}
            </StatusWord>,
            fmtDate(task.dueOn),
          ]}
        />
      }
      title={task.title}
      actions={actions}
    >
      <div className="ig-tags">
        <Tag tone="outlined">{SKILL_LABEL[task.category]}</Tag>
        {home && <Tag tone="outlined">{home.label}</Tag>}
        <Tag tone="muted">{source}</Tag>
      </div>
      {task.note && <p className="sheet-text paragraph-small">{task.note}</p>}
      {need && <p className="sheet-note paragraph-x-small">From your request: {need.title}</p>}
      <List rule="none">
        {p ? (
          <ListRow leading={<Avatar size="md" name={p.name} src={p.avatar} />} title={p.name} facts={`${p.roleLine}.`} chevron onPress={() => sheets.swap({ kind: "provider", id: p.id })} />
        ) : (
          <ListRow title="" facts={task.status === "queued" ? "Waiting for the right person and the right month." : "Colony will assign someone."} />
        )}
      </List>
    </SheetContent>
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
  const all = [eng, ...siblings];
  const visits = all.reduce((a, e) => a + occurrences(e.cadence, month, e.startsOn).length, 0);
  const first = p?.name.split(" ")[0];
  return (
    <SheetContent eyebrow={<MetaLine facts={["Direct funds", fmtMonth(month)]} />} title={p?.name}>
      <List rule="none">
        <ListRow leading={<Avatar size="md" name={p?.name ?? ""} src={p?.avatar} />} title={p ? `${p.roleLine}.` : ""} chevron onPress={() => p && sheets.swap({ kind: "provider", id: p.id })} />
      </List>
      <Panel>
        <PanelHead title="This month" meta={`${visits} visits`} rule="ink" />
        <List rule="none">
          {all.map((e) => {
            const d = occurrences(e.cadence, month, e.startsOn);
            return (
              <ListRow
                key={e.id}
                title={e.label}
                facts={[cadenceLabel(e.cadence), e.homeIds.map((h) => maps.homes.get(h)?.label).join(" and ")]}
                trailing={<Figure value={e.costCents * d.length} format={fmt} size="sm" />}
                trailingMeta={`${d.length} × ${fmt(e.costCents)}`}
              />
            );
          })}
        </List>
      </Panel>
      <Panel>
        <PanelHead title="Dates" />
        <div className="ig-tags">
          {dates.map((d) => (
            <Tag key={d} tone="outlined">
              {fmtDate(d).replace(", ", " ")}
            </Tag>
          ))}
        </div>
      </Panel>
      <p className="sheet-note paragraph-x-small">
        {COPY.noCut} Bonuses and tips go straight to {first}.
      </p>
    </SheetContent>
  );
}

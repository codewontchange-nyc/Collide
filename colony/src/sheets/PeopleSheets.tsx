import { useColonyState } from "@/store/store";
import { useMaps } from "@/store/selectors";
import { SheetContent, Button, Avatar, Tag, StatusWord, MetaLine, Kicker, Figure, Panel, PanelHead, List, ListRow, sheets } from "@/system";
import { fmt } from "@/domain/money";
import { WEEKDAY_SHORT, fmtDate, fmtTime, compareDates } from "@/domain/dates";
import { SKILL_LABEL, type Weekday } from "@/domain/types";

const WEEK: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export function ProviderSheet({ id }: { id: string }) {
  const state = useColonyState();
  const maps = useMaps();
  const p = maps.providers.get(id);
  if (!p) return null;
  const upcoming = state.schedule
    .filter((s) => s.providerId === p.id && s.status === "planned" && compareDates(s.date, state.meta.simToday) >= 0)
    .sort((a, b) => compareDates(a.date, b.date))
    .slice(0, 3);
  const brought = p.broughtBy ? maps.people.get(p.broughtBy) : undefined;
  const days = new Set(p.availability.map((a) => a.day));
  const first = p.name.split(" ")[0];
  return (
    <SheetContent
      eyebrow={<MetaLine facts={p.kind === "direct" ? ["Direct funds"] : ["Smart match", "Pool funded"]} />}
      title={p.name}
      actions={
        p.kind === "indirect" ? (
          <Button block onClick={() => sheets.swap({ kind: "request", category: p.primary })}>
            Request {first}
          </Button>
        ) : undefined
      }
    >
      <div className="sheet-head-block">
        <Avatar size="lg" name={p.name} src={p.avatar} />
        <div className="sheet-head-block__main">
          <p className="sheet-head-block__lede paragraph-medium">{p.roleLine}.</p>
          <MetaLine tone="meta" facts={[p.area, `Serves ${p.homesServed} homes`, `Rated ${p.rating.toFixed(1)}`]} />
        </div>
      </div>
      <p className="sheet-text paragraph-small">{p.bio}</p>
      <div className="ig-tags">
        {p.skills.map((s) => (
          <Tag key={s} tone={s === p.primary ? "ink" : "muted"}>
            {SKILL_LABEL[s]}
          </Tag>
        ))}
        <Tag tone="outlined">
          {fmt(p.rateCents)} {p.rateUnit === "hour" ? "an hour" : "a visit"}
        </Tag>
      </div>
      {brought && <p className="sheet-note paragraph-x-small">Brought into the colony by {brought.name.split(" ")[0]}.</p>}
      <Panel>
        <PanelHead title="Usually free" />
        {days.size === 0 ? (
          <StatusWord state="inactive">By request</StatusWord>
        ) : (
          <div className="ig-tags">
            {WEEK.map((d) =>
              days.has(d) ? (
                <Tag key={d} tone="outlined">
                  {WEEKDAY_SHORT[d]}
                </Tag>
              ) : (
                <Tag key={d} tone="muted" state="inactive">
                  {WEEKDAY_SHORT[d]}
                </Tag>
              ),
            )}
          </div>
        )}
      </Panel>
      {upcoming.length > 0 && (
        <Panel>
          <PanelHead title="Coming up" />
          <List rule="none">
            {upcoming.map((s) => (
              <ListRow key={s.id} title={s.title} facts={[maps.homes.get(s.homeId)?.label, fmtDate(s.date), fmtTime(s.start)]} chevron onPress={() => sheets.swap({ kind: "visit", id: s.id })} />
            ))}
          </List>
        </Panel>
      )}
    </SheetContent>
  );
}

export function PersonSheet({ id }: { id: string }) {
  const state = useColonyState();
  const maps = useMaps();
  const p = maps.people.get(id);
  if (!p) return null;
  const hh = maps.households.get(p.householdId);
  const home = hh ? maps.homes.get(hh.homeId) : undefined;
  const brought = state.providers.filter((x) => x.broughtBy === p.id);
  return (
    <SheetContent eyebrow={<MetaLine facts={[p.role === "steward" ? "Steward" : "Member"]} />} title={p.name}>
      <List rule="none">
        <ListRow
          leading={<Avatar size="md" name={p.name} src={p.avatar} />}
          title={home?.label ?? ""}
          facts={[home?.area]}
          trailing={<Figure value={p.contributionCents} format={fmt} size="sm" />}
          trailingMeta="A month"
        />
      </List>
      {p.bio && <p className="sheet-text paragraph-small">{p.bio}</p>}
      <p className="sheet-serif paragraph-medium">{p.role === "steward" ? "Keeps the colony honest and the budget kind." : "Makes someone else's life easier, every month."}</p>
      {brought.length > 0 && (
        <Panel>
          <PanelHead title="Brought to the colony" />
          <List rule="none">
            {brought.map((x) => (
              <ListRow
                key={x.id}
                leading={<Avatar size="md" name={x.name} src={x.avatar} />}
                title={x.name}
                trailing={<Tag tone="outlined">{SKILL_LABEL[x.primary]}</Tag>}
                onPress={() => sheets.swap({ kind: "provider", id: x.id })}
              />
            ))}
          </List>
        </Panel>
      )}
    </SheetContent>
  );
}

export function HouseholdSheet({ id }: { id: string }) {
  const state = useColonyState();
  const maps = useMaps();
  const hh = maps.households.get(id);
  if (!hh) return null;
  const home = maps.homes.get(hh.homeId);
  const people = hh.personIds.map((pid) => maps.people.get(pid)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const contribution = people.reduce((a, p) => a + p.contributionCents, 0);
  const visits = state.schedule
    .filter((s) => s.homeId === hh.homeId && s.status === "planned" && compareDates(s.date, state.meta.simToday) >= 0)
    .sort((a, b) => compareDates(a.date, b.date))
    .slice(0, 4);
  return (
    <SheetContent eyebrow={<MetaLine facts={["Household", home?.area]} />} title={home?.label}>
      {home && <MetaLine tone="meta" facts={[home.address]} />}
      <List rule="none">
        {people.map((p) => (
          <ListRow
            key={p.id}
            leading={<Avatar size="md" name={p.name} src={p.avatar} />}
            title={p.name}
            trailing={<Figure value={p.contributionCents} format={fmt} size="sm" />}
            onPress={() => sheets.swap({ kind: "person", id: p.id })}
          />
        ))}
        <ListRow rule="ink" title={<Kicker as="span">Together</Kicker>} trailing={<Figure value={contribution} format={fmt} size="sm" />} trailingMeta="A month" />
      </List>
      {home && <StatusWord state="success">{home.plantCount} plants</StatusWord>}
      {home?.notes && <p className="sheet-note paragraph-x-small">{home.notes}</p>}
      {visits.length > 0 && (
        <Panel>
          <PanelHead title="Coming up here" />
          <List rule="none">
            {visits.map((s) => {
              const prov = maps.providers.get(s.providerId);
              return (
                <ListRow
                  key={s.id}
                  leading={<Avatar size="md" name={prov?.name ?? ""} src={prov?.avatar} />}
                  title={s.title}
                  facts={[fmtDate(s.date), fmtTime(s.start)]}
                  chevron
                  onPress={() => sheets.swap({ kind: "visit", id: s.id })}
                />
              );
            })}
          </List>
        </Panel>
      )}
    </SheetContent>
  );
}

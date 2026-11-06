import { useColonyState } from "@/store/store";
import { useMaps } from "@/store/selectors";
import { Sheet } from "@/ui/Sheet";
import { Avatar } from "@/ui/Avatar";
import { Chip } from "@/ui/Chip";
import { Btn } from "@/ui/Btn";
import { Icon } from "@/ui/Icon";
import { sheets } from "@/ui/sheetStore";
import { fmt } from "@/domain/money";
import { WEEKDAY_SHORT, fmtDate, fmtTime, compareDates } from "@/domain/dates";
import { SKILL_LABEL } from "@/domain/types";

export function ProviderSheet({ id }: { id: string }) {
  const state = useColonyState();
  const maps = useMaps();
  const p = maps.providers.get(id);
  if (!p) return null;
  const upcoming = state.schedule.filter((s) => s.providerId === p.id && s.status === "planned" && compareDates(s.date, state.meta.simToday) >= 0).sort((a, b) => compareDates(a.date, b.date)).slice(0, 3);
  const brought = p.broughtBy ? maps.people.get(p.broughtBy) : undefined;
  const days = [...new Set(p.availability.map((a) => a.day))].sort();
  return (
    <Sheet
      kicker={p.kind === "direct" ? "Direct funds" : "Smart match, pool funded"}
      title={p.name}
      foot={
        p.kind === "indirect" ? (
          <Btn block onClick={() => sheets.swap({ kind: "request", category: p.primary })}>
            Request {p.name.split(" ")[0]}
          </Btn>
        ) : undefined
      }
    >
      <div className="row" style={{ alignItems: "flex-start" }}>
        <Avatar name={p.name} src={p.avatar} size="lg" />
        <div className="grow">
          <p className="voice" style={{ fontSize: 17 }}>
            {p.roleLine}
          </p>
          <div className="small muted" style={{ marginTop: 4 }}>
            <Icon name="pin" size={13} /> {p.area}, serves {p.homesServed} homes
          </div>
        </div>
      </div>
      <p className="sub" style={{ marginTop: 16 }}>
        {p.bio}
      </p>
      <div className="chips" style={{ marginTop: 14 }}>
        {p.skills.map((s) => (
          <Chip key={s} tone={s === p.primary ? "ink" : "paper"}>
            {SKILL_LABEL[s]}
          </Chip>
        ))}
        <Chip tone="honey">
          <Icon name="star" size={12} /> {p.rating.toFixed(1)}
        </Chip>
        <Chip tone="line">
          {fmt(p.rateCents)} a {p.rateUnit === "hour" ? "hour" : "visit"}
        </Chip>
      </div>
      {brought && (
        <p className="small muted" style={{ marginTop: 14 }}>
          Brought into the colony by {brought.name.split(" ")[0]}.
        </p>
      )}
      <div className="kicker" style={{ marginTop: 22, marginBottom: 8, marginLeft: 0 }}>
        Usually free
      </div>
      <div className="chips">
        {days.map((d) => (
          <Chip key={d} tone="line">
            {WEEKDAY_SHORT[d]}
          </Chip>
        ))}
        {days.length === 0 && <span className="small muted">By request</span>}
      </div>
      {upcoming.length > 0 && (
        <>
          <div className="kicker" style={{ marginTop: 22, marginBottom: 6, marginLeft: 0 }}>
            Coming up
          </div>
          <div className="list">
            {upcoming.map((s) => (
              <button key={s.id} type="button" className="item press" onClick={() => sheets.swap({ kind: "visit", id: s.id })}>
                <div className="grow">
                  <div className="t">{s.title}</div>
                  <div className="m">
                    {maps.homes.get(s.homeId)?.label}, {fmtDate(s.date)}, {fmtTime(s.start)}
                  </div>
                </div>
                <Icon name="chev" size={16} />
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
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
    <Sheet kicker={p.role === "steward" ? "Steward" : "Member"} title={p.name}>
      <div className="row">
        <Avatar name={p.name} src={p.avatar} size="lg" />
        <div className="grow">
          <div style={{ fontWeight: 400 }}>{home?.label}</div>
          <div className="small muted">{home?.area}</div>
        </div>
        <div className="right">
          <div className="money">{fmt(p.contributionCents)}</div>
          <div className="tiny muted">a month</div>
        </div>
      </div>
      {p.bio && (
        <p className="sub" style={{ marginTop: 16 }}>
          {p.bio}
        </p>
      )}
      <p className="voice" style={{ marginTop: 18, fontSize: 17 }}>
        {p.role === "steward" ? "Keeps the colony honest and the budget kind." : "Makes someone else's life easier, every month."}
      </p>
      {brought.length > 0 && (
        <>
          <div className="kicker" style={{ marginTop: 22, marginBottom: 6, marginLeft: 0 }}>
            Brought to the colony
          </div>
          <div className="list">
            {brought.map((x) => (
              <button key={x.id} type="button" className="item press" onClick={() => sheets.swap({ kind: "provider", id: x.id })}>
                <Avatar name={x.name} src={x.avatar} size="sm" />
                <div className="grow t">{x.name}</div>
                <Chip tone="line">{SKILL_LABEL[x.primary]}</Chip>
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

export function HouseholdSheet({ id }: { id: string }) {
  const state = useColonyState();
  const maps = useMaps();
  const hh = maps.households.get(id);
  if (!hh) return null;
  const home = maps.homes.get(hh.homeId);
  const people = hh.personIds.map((pid) => maps.people.get(pid)).filter(Boolean);
  const contribution = people.reduce((a, p) => a + (p?.contributionCents ?? 0), 0);
  const visits = state.schedule.filter((s) => s.homeId === hh.homeId && s.status === "planned" && compareDates(s.date, state.meta.simToday) >= 0).sort((a, b) => compareDates(a.date, b.date)).slice(0, 4);
  return (
    <Sheet kicker="Household" title={home?.label}>
      <p className="sub">
        {home?.address}, {home?.area}
      </p>
      <div className="row" style={{ marginTop: 14 }}>
        {people.map((p) => (
          <button key={p!.id} type="button" className="row" onClick={() => sheets.swap({ kind: "person", id: p!.id })}>
            <Avatar name={p!.name} src={p!.avatar} size="sm" />
            <span className="small">{p!.name.split(" ")[0]}</span>
          </button>
        ))}
        <span className="money" style={{ marginLeft: "auto" }}>
          {fmt(contribution)}
        </span>
      </div>
      <div className="chips" style={{ marginTop: 14 }}>
        <Chip tone="ok">
          <Icon name="leaf" size={12} /> {home?.plantCount} plants
        </Chip>
      </div>
      {home?.notes && (
        <p className="small muted" style={{ marginTop: 14 }}>
          {home.notes}
        </p>
      )}
      <div className="kicker" style={{ marginTop: 22, marginBottom: 6, marginLeft: 0 }}>
        Coming up here
      </div>
      <div className="list">
        {visits.map((s) => (
          <button key={s.id} type="button" className="item press" onClick={() => sheets.swap({ kind: "visit", id: s.id })}>
            <Avatar name={maps.providers.get(s.providerId)?.name ?? ""} src={maps.providers.get(s.providerId)?.avatar} size="sm" />
            <div className="grow">
              <div className="t">{s.title}</div>
              <div className="m">
                {fmtDate(s.date)}, {fmtTime(s.start)}
              </div>
            </div>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

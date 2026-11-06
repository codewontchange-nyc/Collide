import { useMemo, useRef } from "react";
import { useColonyState } from "@/store/store";
import { useMaps } from "@/store/selectors";
import { Screen, Rise } from "@/ui/Screen";
import { PageHead, Kicker } from "@/ui/PageHead";
import { Avatar } from "@/ui/Avatar";
import { Chip } from "@/ui/Chip";
import { Btn } from "@/ui/Btn";
import { Icon } from "@/ui/Icon";
import { sheets } from "@/ui/sheetStore";
import { fmtMonth, monthOf } from "@/domain/dates";
import { SKILL_LABEL } from "@/domain/types";
import type { Provider } from "@/domain/types";

export function ColonyScreen() {
  const state = useColonyState();
  const maps = useMaps();
  const tribe = useMemo(() => state.providers.filter((p) => p.broughtBy), [state.providers]);
  const matched = useMemo(() => state.providers.filter((p) => !p.broughtBy), [state.providers]);
  const hold = useRef<ReturnType<typeof setTimeout>>(undefined);

  const press = {
    onPointerDown: () => {
      hold.current = setTimeout(() => sheets.open({ kind: "manifesto" }), 550);
    },
    onPointerUp: () => clearTimeout(hold.current),
    onPointerLeave: () => clearTimeout(hold.current),
  };

  const ProviderRow = ({ p }: { p: Provider }) => (
    <button type="button" className="item press" onClick={() => sheets.open({ kind: "provider", id: p.id })}>
      <Avatar name={p.name} src={p.avatar} />
      <div className="grow">
        <div className="t">{p.name}</div>
        <div className="m">
          <em style={{ fontSize: 14 }}>{p.roleLine}</em>
        </div>
      </div>
      <Chip tone={p.kind === "direct" ? "ink" : "honey"}>{SKILL_LABEL[p.primary]}</Chip>
    </button>
  );

  return (
    <Screen>
      <Rise>
        <PageHead kicker={`Since ${fmtMonth(monthOf(state.colony.createdAt))}`} title={<span {...press} style={{ userSelect: "none", WebkitUserSelect: "none" }}>{state.colony.name}</span>} sub={`${state.people.length} members, ${state.homes.length} homes, ${state.providers.length} people who show up.`} />
        <div className="row" style={{ gap: 8 }}>
          <Btn size="sm" variant="ghost" onClick={() => sheets.open({ kind: "invite" })}>
            <Icon name="share" size={16} /> Invite
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => sheets.open({ kind: "bring" })}>
            <Icon name="plus" size={16} /> Bring someone
          </Btn>
        </div>
      </Rise>

      <Rise className="section">
        <Kicker>Members</Kicker>
        <div className="list">
          {state.people.map((p) => (
            <button key={p.id} type="button" className="item press" onClick={() => sheets.open({ kind: "person", id: p.id })}>
              <Avatar name={p.name} src={p.avatar} />
              <div className="grow">
                <div className="t">{p.name}</div>
                <div className="m">{maps.homes.get(maps.households.get(p.householdId)?.homeId ?? "")?.label}</div>
              </div>
              <Chip tone={p.role === "steward" ? "honey" : "paper"}>{p.role === "steward" ? "Steward" : "Member"}</Chip>
            </button>
          ))}
        </div>
      </Rise>

      <Rise className="section off">
        <Kicker>Households</Kicker>
        <div className="list">
          {state.households.map((h) => {
            const home = maps.homes.get(h.homeId);
            return (
              <button key={h.id} type="button" className="item press" onClick={() => sheets.open({ kind: "household", id: h.id })}>
                <div className="grow">
                  <div className="t">{home?.label}</div>
                  <div className="m">
                    {home?.area}, {home?.plantCount} plants
                  </div>
                </div>
                <span className="faces">
                  {h.personIds.map((id) => {
                    const p = maps.people.get(id);
                    return p ? <Avatar key={id} name={p.name} src={p.avatar} size="sm" /> : null;
                  })}
                </span>
              </button>
            );
          })}
        </div>
      </Rise>

      <Rise className="section">
        <Kicker>Your tribe</Kicker>
        <p className="small muted" style={{ marginBottom: 4 }}>
          People you brought with you. They stay yours.
        </p>
        <div className="list">
          {tribe.map((p) => (
            <ProviderRow key={p.id} p={p} />
          ))}
        </div>
      </Rise>

      <Rise className="section off">
        <Kicker honey>Smart matched</Kicker>
        <p className="small muted" style={{ marginBottom: 4 }}>
          Curated by Colony for your lifestyle and your streets.
        </p>
        <div className="list">
          {matched.map((p) => (
            <ProviderRow key={p.id} p={p} />
          ))}
        </div>
      </Rise>
    </Screen>
  );
}

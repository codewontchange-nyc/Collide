import { useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useColonyState } from "@/store/store";
import { useMaps } from "@/store/selectors";
import { Screen, Rise, PageIntro, MetaLine, Companion, QuietButton, MetricStrip, Panel, PanelHead, List, ListRow, Avatar, AvatarStack, Tag, EmptyState, sheets, companion } from "@/system";
import { fmtMonth, monthOf } from "@/domain/dates";
import { SKILL_LABEL } from "@/domain/types";
import type { Provider } from "@/domain/types";
import "./Colony.css";

/* The manifesto long press: the one duration the kit has no token for, named once and handed to the CSS as a custom property. */
const HOLD_MS = 550;
const CANCEL_PX = 8;

export function ColonyScreen() {
  const state = useColonyState();
  const maps = useMaps();
  const tribe = useMemo(() => state.providers.filter((p) => p.broughtBy), [state.providers]);
  const matched = useMemo(() => state.providers.filter((p) => !p.broughtBy), [state.providers]);
  const hold = useRef<ReturnType<typeof setTimeout>>(undefined);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const [pressing, setPressing] = useState(false);

  const cancel = () => {
    clearTimeout(hold.current);
    hold.current = undefined;
    origin.current = null;
    if (pressing) {
      setPressing(false);
      companion.rest();
    }
  };
  const press = {
    onPointerDown: (e: PointerEvent<HTMLSpanElement>) => {
      origin.current = { x: e.clientX, y: e.clientY };
      setPressing(true);
      companion.gather(HOLD_MS);
      hold.current = setTimeout(() => {
        hold.current = undefined;
        setPressing(false);
        sheets.open({ kind: "manifesto" });
      }, HOLD_MS);
    },
    onPointerMove: (e: PointerEvent<HTMLSpanElement>) => {
      const o = origin.current;
      if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > CANCEL_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
  };

  const providers = state.providers.length;
  const lede = tribe.length === 0 ? `${providers} people show up here, all matched by Colony.` : `${providers} people show up here, ${tribe.length} you brought, ${matched.length} matched by Colony.`;

  const ProviderRow = ({ p, skill }: { p: Provider; skill: "muted" | "outlined" }) => (
    <ListRow
      leading={<Avatar size="md" name={p.name} src={p.avatar} />}
      title={p.name}
      facts={p.roleLine}
      factsLine={[p.kind === "direct" ? "DIRECT FUNDS" : "POOL FUNDED"]}
      trailing={<Tag tone={skill}>{SKILL_LABEL[p.primary]}</Tag>}
      onPress={() => sheets.open({ kind: "provider", id: p.id })}
    />
  );

  return (
    <Screen title="Colony">
      <Rise index={0}>
        <PageIntro
          eyebrow={<MetaLine facts={[`SINCE ${fmtMonth(monthOf(state.colony.createdAt)).toUpperCase()}`]} />}
          aside={<Companion />}
          title={
            <span className="colony-name" data-pressing={pressing ? "true" : "false"} style={{ "--colony-hold": `${HOLD_MS}ms` } as CSSProperties} {...press}>
              {state.colony.name}
            </span>
          }
          titleMuted={`${state.people.length} members, ${state.homes.length} homes`}
          intro={lede}
          editorial
        >
          <div className="colony-actions">
            <QuietButton tone="ink" onClick={() => sheets.open({ kind: "invite" })}>
              INVITE
            </QuietButton>
            <QuietButton tone="ink" onClick={() => sheets.open({ kind: "bring" })}>
              BRING SOMEONE
            </QuietButton>
          </div>
        </PageIntro>
      </Rise>

      <Rise index={1}>
        <MetricStrip
          columns={2}
          items={[
            { label: "YOUR TRIBE", value: tribe.length, note: "they stay yours" },
            { label: "MATCHED", value: matched.length, note: "for your streets" },
          ]}
        />
      </Rise>

      <Rise index={2}>
        <Panel>
          <PanelHead title="Members" />
          <List>
            {state.people.map((p) => (
              <ListRow
                key={p.id}
                leading={<Avatar size="md" name={p.name} src={p.avatar} />}
                title={p.name}
                facts={[maps.homes.get(maps.households.get(p.householdId)?.homeId ?? "")?.label]}
                trailing={p.role === "steward" ? <Tag tone="ink">STEWARD</Tag> : undefined}
                onPress={() => sheets.open({ kind: "person", id: p.id })}
              />
            ))}
          </List>
        </Panel>
      </Rise>

      <Rise index={3}>
        <Panel>
          <PanelHead title="Households" />
          <List>
            {state.households.map((h) => {
              const home = maps.homes.get(h.homeId);
              const people = h.personIds.map((id) => maps.people.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
              return (
                <ListRow
                  key={h.id}
                  title={home?.label ?? h.name}
                  facts={[home?.area?.toUpperCase(), `${home?.plantCount ?? 0} PLANTS`]}
                  trailing={<AvatarStack people={people} size="sm" max={4} />}
                  onPress={() => sheets.open({ kind: "household", id: h.id })}
                />
              );
            })}
          </List>
        </Panel>
      </Rise>

      <Rise index={4}>
        <Panel>
          <PanelHead title="Your tribe" meta="THEY STAY YOURS" description="People you brought with you." />
          {tribe.length === 0 ? (
            <EmptyState body="No one brought in yet." />
          ) : (
            <List>
              {tribe.map((p) => (
                <ProviderRow key={p.id} p={p} skill="muted" />
              ))}
            </List>
          )}
        </Panel>
      </Rise>

      <Rise index={5}>
        <Panel>
          <PanelHead title="Smart matched" meta={String(matched.length)} description="Matched by Colony for your streets and your lifestyle." />
          <List>
            {matched.map((p) => (
              <ProviderRow key={p.id} p={p} skill="outlined" />
            ))}
          </List>
        </Panel>
      </Rise>
    </Screen>
  );
}

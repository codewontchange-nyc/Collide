import { useColonyState } from "@/store/store";
import { currentProvider } from "@/store/selectors";
import { Screen, Rise, PageIntro, MetaLine, Panel, PanelHead, List, ListRow, StatusWord, SelectField, Switch, Quote, EmptyState, toast } from "@/system";
import { BackToMember } from "./Today";
import { WEEKDAY_LONG, fmtTime } from "@/domain/dates";
import { COPY } from "@/domain/copy";
import { setAvailability } from "@/store/actions";
import type { AvailabilityWindow, Weekday } from "@/domain/types";

const DAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
type Hours = "08:00-12:00" | "12:00-17:00" | "08:00-17:00" | "17:00-21:00";
const HOURS: { value: Hours; label: string }[] = [
  { value: "08:00-12:00", label: "Mornings" },
  { value: "12:00-17:00", label: "Afternoons" },
  { value: "08:00-17:00", label: "All day" },
  { value: "17:00-21:00", label: "Evenings" },
];

export function Availability() {
  const state = useColonyState();
  const me = currentProvider(state);
  if (!me) {
    return (
      <Screen title="Availability">
        <EmptyState body="No provider selected." />
      </Screen>
    );
  }

  const windows = me.availability;
  const byDay = new Map<Weekday, AvailabilityWindow>(windows.map((w) => [w.day, w]));

  const update = (next: AvailabilityWindow[]) => {
    setAvailability(me.id, next);
    toast.show(COPY.toast.availability);
  };

  return (
    <Screen title="Availability">
      <Rise index={0}>
        <PageIntro
          eyebrow={<MetaLine facts={["Provider view", "Your week"]} />}
          aside={<BackToMember />}
          title="Availability"
          titleMuted="on your terms"
          intro="Colony only matches you into windows you keep open."
          editorial
        />
      </Rise>
      <Rise index={1}>
        <Panel>
          <PanelHead title="Days" meta={`${windows.length} open`} />
          <List rule="none">
            {DAYS.map((d) => {
              const w = byDay.get(d);
              const day = WEEKDAY_LONG[d];
              return (
                <ListRow
                  key={d}
                  title={day}
                  facts={w ? [`${fmtTime(w.from)} to ${fmtTime(w.to)}`] : <StatusWord state="inactive">Off</StatusWord>}
                  trailing={
                    <>
                      {w && (
                        <SelectField<Hours>
                          hideLabel
                          overlay
                          label={`Hours on ${day}`}
                          options={HOURS}
                          value={`${w.from}-${w.to}` as Hours}
                          onChange={(v) => {
                            const [from, to] = v.split("-");
                            if (from && to) update(windows.map((x) => (x.day === d ? { ...x, from, to } : x)));
                          }}
                        />
                      )}
                      <Switch hideLabel label={day} checked={!!w} onChange={(on) => update(on ? [...windows, { day: d, from: "08:00", to: "12:00" }] : windows.filter((x) => x.day !== d))} />
                    </>
                  }
                />
              );
            })}
          </List>
        </Panel>
      </Rise>
      <Rise index={2}>
        <Quote>{COPY.manifesto[3]}</Quote>
      </Rise>
    </Screen>
  );
}

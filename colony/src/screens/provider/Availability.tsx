import { useColonyState } from "@/store/store";
import { currentProvider } from "@/store/selectors";
import { Screen, Rise } from "@/ui/Screen";
import { PageHead, Kicker } from "@/ui/PageHead";
import { Toggle } from "@/ui/Toggle";
import { Empty } from "@/ui/Empty";
import { toast } from "@/ui/Toast";
import { ModeBar } from "./Today";
import { WEEKDAY_LONG, fmtTime } from "@/domain/dates";
import { COPY } from "@/domain/copy";
import { setAvailability } from "@/store/actions";
import type { AvailabilityWindow, Weekday } from "@/domain/types";

const DAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export function Availability() {
  const state = useColonyState();
  const me = currentProvider(state);
  if (!me) return <Screen><Empty line="No provider selected." /></Screen>;

  const windows = me.availability;
  const byDay = new Map<Weekday, AvailabilityWindow>(windows.map((w) => [w.day, w]));

  const update = (next: AvailabilityWindow[]) => {
    setAvailability(me.id, next);
    toast.show(COPY.toast.availability);
  };

  return (
    <Screen>
      <Rise>
        <ModeBar />
        <PageHead kicker="Your week" title="Availability" sub="Colony only matches you into windows you keep open. Flexible, on your terms." companion={false} />
      </Rise>
      <Rise className="section">
        <Kicker>Days</Kicker>
        <div className="list">
          {DAYS.map((d) => {
            const w = byDay.get(d);
            return (
              <div key={d} className="item">
                <div className="grow">
                  <div className="t">{WEEKDAY_LONG[d]}</div>
                  <div className="m">{w ? `${fmtTime(w.from)} to ${fmtTime(w.to)}` : "Off"}</div>
                </div>
                {w && (
                  <select
                    className="field"
                    style={{ width: 130, minHeight: 40, padding: "6px 10px" }}
                    value={`${w.from}-${w.to}`}
                    onChange={(e) => {
                      const [from, to] = e.target.value.split("-");
                      update(windows.map((x) => (x.day === d ? { ...x, from, to } : x)));
                    }}
                    aria-label={`Hours on ${WEEKDAY_LONG[d]}`}
                  >
                    <option value="08:00-12:00">Mornings</option>
                    <option value="12:00-17:00">Afternoons</option>
                    <option value="08:00-17:00">All day</option>
                    <option value="17:00-21:00">Evenings</option>
                  </select>
                )}
                <Toggle on={!!w} label={WEEKDAY_LONG[d]} onChange={(on) => update(on ? [...windows, { day: d, from: "08:00", to: "12:00" }] : windows.filter((x) => x.day !== d))} />
              </div>
            );
          })}
        </div>
      </Rise>
      <Rise className="section off">
        <p className="voice">{COPY.manifesto[3]}</p>
      </Rise>
    </Screen>
  );
}

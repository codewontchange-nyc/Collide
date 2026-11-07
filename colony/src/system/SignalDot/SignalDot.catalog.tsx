import type { CatalogEntry } from "@/system/catalog";
import { Specimen } from "@/system/library/Specimen";
import { SignalDot, StatusWord, type DotState } from "./SignalDot";

const STATES: DotState[] = ["default", "error", "success", "inactive"];

export const entries: CatalogEntry[] = [
  {
    id: "signal-dot",
    name: "SignalDot",
    group: "Marks and status",
    tasks: ["say a state", "mark something live", "show that something failed", "status"],
    variants: [...STATES, "pulse", "no pulse", "tight", "label", "on a ground"],
    render: () => (
      <>
        {STATES.map((s) => (
          <Specimen key={s} label={s}>
            <SignalDot state={s} />
          </Specimen>
        ))}
        <Specimen label="pulse">
          <SignalDot state="default" pulse />
        </Specimen>
        <Specimen label="no pulse">
          <SignalDot state="success" pulse={false} />
        </Specimen>
        <Specimen label="tight">
          <SignalDot state="success" className="ig-dot--tight" />
        </Specimen>
        <Specimen label="label">
          <SignalDot state="error" label="Past due" />
        </Specimen>
        <Specimen label="on a ground" ground="ground">
          <SignalDot state="inactive" />
          <SignalDot state="default" />
        </Specimen>
      </>
    ),
  },
  {
    id: "status-word",
    name: "StatusWord",
    group: "Marks and status",
    tasks: ["say what happened", "say what is waiting on someone", "done", "scheduled", "past due"],
    variants: ["success", "default", "default pulse", "error", "inactive", "ink", "secondary"],
    render: () => (
      <>
        <Specimen label="success">
          <StatusWord state="success">Done</StatusWord>
          <StatusWord state="success">Scheduled</StatusWord>
        </Specimen>
        <Specimen label="default">
          <StatusWord state="default">Queued</StatusWord>
          <StatusWord state="default">In 2 months</StatusWord>
        </Specimen>
        <Specimen label="default pulse">
          <StatusWord state="default" pulse>
            Needs you
          </StatusWord>
          <StatusWord state="default" pulse>
            Finding people
          </StatusWord>
        </Specimen>
        <Specimen label="error">
          <StatusWord state="error">Past due</StatusWord>
          <StatusWord state="error">Short</StatusWord>
        </Specimen>
        <Specimen label="inactive">
          <StatusWord state="inactive">Off</StatusWord>
          <StatusWord state="inactive">Canceled</StatusWord>
        </Specimen>
        <Specimen label="ink">
          <StatusWord state="success" tone="ink">
            Handled
          </StatusWord>
        </Specimen>
        <Specimen label="secondary">
          <StatusWord state="success" tone="secondary">
            Handled
          </StatusWord>
        </Specimen>
      </>
    ),
  },
];

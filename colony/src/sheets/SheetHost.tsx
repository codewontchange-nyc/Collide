import { AnimatePresence } from "motion/react";
import { useSheet } from "@/ui/sheetStore";
import { MealSheet, VisitSheet, TaskSheet, AllocationSheet } from "./ScheduleSheets";
import { ProviderSheet, PersonSheet, HouseholdSheet } from "./PeopleSheets";
import { RequestSheet, MatchSheet } from "./NeedSheets";
import { PoolSheet, AdvanceMonthSheet } from "./PoolSheets";
import { InviteSheet, BringSheet, ManifestoSheet } from "./ColonySheets";

export function SheetHost() {
  const spec = useSheet();
  return (
    <AnimatePresence>
      {spec && (
        <div key={`${spec.kind}:${"id" in spec ? spec.id : "needId" in spec ? spec.needId : "engagementId" in spec ? spec.engagementId : ""}`}>
          {spec.kind === "meal" && <MealSheet id={spec.id} />}
          {spec.kind === "visit" && <VisitSheet id={spec.id} />}
          {spec.kind === "task" && <TaskSheet id={spec.id} />}
          {spec.kind === "allocation" && <AllocationSheet engagementId={spec.engagementId} />}
          {spec.kind === "provider" && <ProviderSheet id={spec.id} />}
          {spec.kind === "person" && <PersonSheet id={spec.id} />}
          {spec.kind === "household" && <HouseholdSheet id={spec.id} />}
          {spec.kind === "request" && <RequestSheet homeId={spec.homeId} category={spec.category} />}
          {spec.kind === "match" && <MatchSheet needId={spec.needId} />}
          {spec.kind === "pool" && <PoolSheet />}
          {spec.kind === "advance" && <AdvanceMonthSheet />}
          {spec.kind === "invite" && <InviteSheet />}
          {spec.kind === "bring" && <BringSheet />}
          {spec.kind === "manifesto" && <ManifestoSheet />}
        </div>
      )}
    </AnimatePresence>
  );
}

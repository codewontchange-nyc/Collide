import { AnimatePresence, motion } from "motion/react";
import { Sheet, sheets, useSheet, appear, useReducedMotion } from "@/system";
import type { SheetSpec } from "@/system";
import { MealSheet, VisitSheet, TaskSheet, AllocationSheet } from "./ScheduleSheets";
import { ProviderSheet, PersonSheet, HouseholdSheet } from "./PeopleSheets";
import { RequestSheet, MatchSheet } from "./NeedSheets";
import { PoolSheet, AdvanceMonthSheet } from "./PoolSheets";
import { InviteSheet, BringSheet, ManifestoSheet } from "./ColonySheets";
import "./sheets.css";

function keyOf(spec: SheetSpec): string {
  const id = "id" in spec ? spec.id : "needId" in spec ? spec.needId : "engagementId" in spec ? spec.engagementId : "";
  return `${spec.kind}:${id}`;
}

function content(spec: SheetSpec) {
  switch (spec.kind) {
    case "meal":
      return <MealSheet id={spec.id} />;
    case "visit":
      return <VisitSheet id={spec.id} />;
    case "task":
      return <TaskSheet id={spec.id} />;
    case "allocation":
      return <AllocationSheet engagementId={spec.engagementId} />;
    case "provider":
      return <ProviderSheet id={spec.id} />;
    case "person":
      return <PersonSheet id={spec.id} />;
    case "household":
      return <HouseholdSheet id={spec.id} />;
    case "request":
      return <RequestSheet homeId={spec.homeId} category={spec.category} />;
    case "match":
      return <MatchSheet needId={spec.needId} />;
    case "pool":
      return <PoolSheet />;
    case "advance":
      return <AdvanceMonthSheet />;
    case "invite":
      return <InviteSheet />;
    case "bring":
      return <BringSheet />;
    case "manifesto":
      return <ManifestoSheet />;
  }
}

/** One system Sheet, always mounted; the open sheet's content swaps inside it. A swap keeps the panel and cross fades the body. */
export function SheetHost() {
  const spec = useSheet();
  const reduced = useReducedMotion();
  return (
    <Sheet open={!!spec} onClose={sheets.close}>
      <AnimatePresence mode="wait" initial={false}>
        {spec && (
          <motion.div key={keyOf(spec)} className="sheet-swap" variants={appear()} initial={reduced ? false : "hidden"} animate="show" exit="exit" custom={0}>
            {content(spec)}
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}

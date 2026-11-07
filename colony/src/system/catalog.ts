/* The catalog entry shape. Every Name.catalog.tsx exports "entries: CatalogEntry[]" typed from here;
   the library page renders CATALOG in section 7 order. */
import type { ReactNode } from "react";

import { entries as glyph } from "./Glyph/Glyph.catalog";
import { entries as dotGrid } from "./DotGrid/DotGrid.catalog";
import { entries as signalDot } from "./SignalDot/SignalDot.catalog";
import { entries as button } from "./Button/Button.catalog";
import { entries as quietButton } from "./QuietButton/QuietButton.catalog";
import { entries as iconButton } from "./IconButton/IconButton.catalog";
import { entries as tag } from "./Tag/Tag.catalog";
import { entries as filterChip } from "./FilterChip/FilterChip.catalog";
import { entries as tabs } from "./Tabs/Tabs.catalog";
import { entries as segmentedMono } from "./SegmentedMono/SegmentedMono.catalog";
import { entries as textField } from "./TextField/TextField.catalog";
import { entries as selectField } from "./SelectField/SelectField.catalog";
import { entries as searchField } from "./SearchField/SearchField.catalog";
import { entries as numberStepper } from "./NumberStepper/NumberStepper.catalog";
import { entries as stepper } from "./Stepper/Stepper.catalog";
import { entries as steps } from "./Steps/Steps.catalog";
import { entries as switchEntries } from "./Switch/Switch.catalog";
import { entries as checkbox } from "./Checkbox/Checkbox.catalog";
import { entries as notice } from "./Notice/Notice.catalog";
import { entries as toastEntries } from "./Toast/Toast.catalog";
import { entries as emptyState } from "./EmptyState/EmptyState.catalog";
import { entries as loading } from "./Loading/Loading.catalog";
import { entries as kicker } from "./Kicker/Kicker.catalog";
import { entries as metaLine } from "./MetaLine/MetaLine.catalog";
import { entries as divider } from "./Divider/Divider.catalog";
import { entries as figure } from "./Figure/Figure.catalog";
import { entries as statTile } from "./StatTile/StatTile.catalog";
import { entries as metricStrip } from "./MetricStrip/MetricStrip.catalog";
import { entries as meter } from "./Meter/Meter.catalog";
import { entries as card } from "./Card/Card.catalog";
import { entries as list } from "./List/List.catalog";
import { entries as avatar } from "./Avatar/Avatar.catalog";
import { entries as weekStrip } from "./WeekStrip/WeekStrip.catalog";
import { entries as tabBar } from "./TabBar/TabBar.catalog";
import { entries as screen } from "./Screen/Screen.catalog";
import { entries as pageIntro } from "./PageIntro/PageIntro.catalog";
import { entries as panelHead } from "./PanelHead/PanelHead.catalog";
import { entries as sheet } from "./Sheet/Sheet.catalog";
import { entries as companion } from "./Companion/Companion.catalog";
import { entries as mark } from "./Mark/Mark.catalog";
import { entries as quote } from "./Quote/Quote.catalog";
import { entries as facts } from "./Facts/Facts.catalog";
import { entries as sticky } from "./Sticky/Sticky.catalog";

export type CatalogGroup =
  | "Foundations"
  | "Pressables"
  | "Marks and status"
  | "Forms"
  | "Feedback"
  | "Text and heads"
  | "Data"
  | "Lists and cards"
  | "People and time"
  | "Shell";

export interface CatalogEntry {
  /** kebab case, unique: "button", "button-fab", "list-row" */
  id: string;
  /** "Button" */
  name: string;
  group: CatalogGroup;
  /** what a person is trying to do, in plain words: "confirm", "primary action", "go forward" */
  tasks: string[];
  /** every variant and state the render shows, in order */
  variants: string[];
  /** a live render of every variant and state, each wrapped in <Specimen label> */
  render: () => ReactNode;
}

/* Every Name.catalog.tsx, concatenated in section 7 order (7.1 Glyph through 7.43 Sticky). */
export const CATALOG: CatalogEntry[] = [
  ...glyph,
  ...dotGrid,
  ...signalDot,
  ...button,
  ...quietButton,
  ...iconButton,
  ...tag,
  ...filterChip,
  ...tabs,
  ...segmentedMono,
  ...textField,
  ...selectField,
  ...searchField,
  ...numberStepper,
  ...stepper,
  ...steps,
  ...switchEntries,
  ...checkbox,
  ...notice,
  ...toastEntries,
  ...emptyState,
  ...loading,
  ...kicker,
  ...metaLine,
  ...divider,
  ...figure,
  ...statTile,
  ...metricStrip,
  ...meter,
  ...card,
  ...list,
  ...avatar,
  ...weekStrip,
  ...tabBar,
  ...screen,
  ...pageIntro,
  ...panelHead,
  ...sheet,
  ...companion,
  ...mark,
  ...quote,
  ...facts,
  ...sticky,
];

if (import.meta.env.DEV) {
  const seen = new Set<string>();
  for (const entry of CATALOG) {
    if (seen.has(entry.id)) console.warn(`Catalog id "${entry.id}" is listed twice.`);
    seen.add(entry.id);
  }
}

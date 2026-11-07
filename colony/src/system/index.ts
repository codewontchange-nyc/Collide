/* The system's public surface, in section 7 order: every component, type and store, then motion. */

// E1
export { Glyph, DotArrow, Caret } from "./Glyph/Glyph";
export type { GlyphName } from "./Glyph/Glyph";
export { DotGrid, AmbientIcon, Jar, PATTERNS, PATTERNS_SM, jarCount } from "./DotGrid/DotGrid";
export type { GridSize, PatternName, UnlitStyle, SettleOrder } from "./DotGrid/DotGrid";
export { SignalDot, StatusWord } from "./SignalDot/SignalDot";
export type { DotState } from "./SignalDot/SignalDot";
export { Button } from "./Button/Button";
export type { ButtonVariant } from "./Button/Button";
export { QuietButton } from "./QuietButton/QuietButton";
export { IconButton } from "./IconButton/IconButton";
export { Tag } from "./Tag/Tag";
export { FilterChip, ChipRow } from "./FilterChip/FilterChip";
export { Tabs } from "./Tabs/Tabs";
export type { TabSpec } from "./Tabs/Tabs";
export { SegmentedMono } from "./SegmentedMono/SegmentedMono";

// E2
export { TextField } from "./TextField/TextField";
export { SelectField } from "./SelectField/SelectField";
export { SearchField } from "./SearchField/SearchField";
export { NumberStepper } from "./NumberStepper/NumberStepper";
export { Stepper } from "./Stepper/Stepper";
export { Steps } from "./Steps/Steps";
export { Switch } from "./Switch/Switch";
export { Checkbox } from "./Checkbox/Checkbox";
export { Notice } from "./Notice/Notice";
export type { NoticeKind, NoticePlacement } from "./Notice/Notice";
export { toast, useToasts, ToastHost } from "./Toast/Toast";
export type { ToastItem } from "./Toast/Toast";
export { overlaySlot, useOverlaySlot } from "./Toast/overlaySlot";
export { EmptyState } from "./EmptyState/EmptyState";
export { Loading } from "./Loading/Loading";

// E1b
export { Kicker } from "./Kicker/Kicker";
export { MetaLine } from "./MetaLine/MetaLine";
export { Divider } from "./Divider/Divider";

// E3
export { Figure } from "./Figure/Figure";
export { StatTile } from "./StatTile/StatTile";
export { MetricStrip } from "./MetricStrip/MetricStrip";
export type { MetricItem } from "./MetricStrip/MetricStrip";
export { Meter } from "./Meter/Meter";
export type { MeterKey, MeterPart } from "./Meter/Meter";
export { Card, CardTop, CardTitle, CardBody } from "./Card/Card";
export type { CardGround } from "./Card/Card";
export { List, ListRow } from "./List/List";
export { Avatar, AvatarStack, initials } from "./Avatar/Avatar";
export type { AvatarSize } from "./Avatar/Avatar";
export { WeekStrip } from "./WeekStrip/WeekStrip";
export type { WeekDay } from "./WeekStrip/WeekStrip";
export { TabBar, MEMBER_TABS, PROVIDER_TABS } from "./TabBar/TabBar";
export type { TabBarItem } from "./TabBar/TabBar";
export { Screen, Rise } from "./Screen/Screen";
export { PageIntro } from "./PageIntro/PageIntro";
export { PanelHead, Panel, Page } from "./PanelHead/PanelHead";
export { Sheet, SheetContent } from "./Sheet/Sheet";
export { sheets, useSheet } from "./Sheet/sheetStore";
export type { SheetSpec } from "./Sheet/sheetStore";
export { Companion } from "./Companion/Companion";
export { companion } from "./Companion/companion";
export type { Mood, CompanionState } from "./Companion/companion";
export { Mark } from "./Mark/Mark";
export { Quote } from "./Quote/Quote";
export { Facts } from "./Facts/Facts";
export type { FactItem } from "./Facts/Facts";
export { Sticky } from "./Sticky/Sticky";

// Library
export { Specimen } from "./library/Specimen";

export * from "./motion";

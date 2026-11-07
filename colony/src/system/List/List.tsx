import { createContext, useContext, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router";
import { Glyph } from "@/system/Glyph/Glyph";
import { MetaLine } from "@/system/MetaLine/MetaLine";

type ListTag = "ul" | "ol" | "div";
const ListContext = createContext<ListTag>("ul");

/** The hairline list. The opening rule: ink for a titled data list, hairline for a plain group, none when a PanelHead already drew it. */
export function List({
  rule = "hairline",
  density = "touch",
  as: Tag = "ul",
  label,
  children,
  className,
}: {
  rule?: "ink" | "hairline" | "none";
  /** touch: 12px 0 with min-height 44 (default); dense: 8px 0; reading: 16px 0 */
  density?: "touch" | "dense" | "reading";
  as?: ListTag;
  /** aria-label when the list has no visible head */
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  const cls = ["ig-list", rule !== "none" ? `ig-list--${rule}` : "", density !== "touch" ? `ig-list--${density}` : "", className].filter(Boolean).join(" ");
  return (
    <ListContext.Provider value={Tag}>
      <Tag className={cls} aria-label={label}>
        {children}
      </Tag>
    </ListContext.Provider>
  );
}

type RowProps = {
  /** the mono column ("01", "MON"); zero padded by the caller */
  index?: string | number;
  /** a ch width: "2ch" (default), "3ch" (MON), "6ch" (NOV 5), "7ch" (2:00 PM), "9ch" (NOV 2 TO 8) */
  indexWidth?: string;
  /** an Avatar md, an Avatar sm, a tile (.ig-row__tile); its own column */
  leading?: ReactNode;
  title: ReactNode;
  /** an array renders a MetaLine (tone secondary); a node renders as a sentence in paragraph-x-small */
  facts?: ReactNode[] | ReactNode;
  /** a MetaLine under a sentence facts (a role line, then the skill) */
  factsLine?: ReactNode[];
  /** a Figure size sm, a StatusWord, a Tag, a QuietButton, a Switch track */
  trailing?: ReactNode;
  /** a label-small neutral-06 line under the trailing figure, right aligned */
  trailingMeta?: ReactNode;
  /** this row's top border is ink: a sum line */
  rule?: "ink";
  /** trailing chevron-right in neutral-04; still needs onPress or href */
  chevron?: boolean;
  onPress?: () => void;
  href?: string;
  disabled?: boolean;
  /** the 2px rail and the neutral-02 fill */
  selected?: boolean;
  /** aria-current="true" plus the rail, for the current step or day */
  current?: boolean;
  /** title on one line */
  ellipsis?: boolean;
  titleAs?: "h3" | "p" | "span";
  className?: string;
} & Omit<HTMLAttributes<HTMLElement>, "title">;

/** One row: index, leading, main, trailing, with the grid built from the cells present. */
export function ListRow({
  index,
  indexWidth,
  leading,
  title,
  facts,
  factsLine,
  trailing,
  trailingMeta,
  rule,
  chevron = false,
  onPress,
  href,
  disabled = false,
  selected = false,
  current = false,
  ellipsis = false,
  titleAs: TitleTag = "span",
  className,
  style,
  ...rest
}: RowProps) {
  const listTag = useContext(ListContext);
  const Item = listTag === "div" ? "div" : "li";
  const pressable = onPress !== undefined || href !== undefined;
  const hasIndex = index !== undefined && index !== null && index !== "";
  const hasLeading = leading !== undefined && leading !== null && leading !== false;
  const hasTrailing = (trailing !== undefined && trailing !== null && trailing !== false) || (trailingMeta !== undefined && trailingMeta !== null) || (chevron && !disabled);
  const cols = `${hasIndex ? "i" : ""}${hasLeading ? "l" : ""}m${hasTrailing ? "t" : ""}`;
  const cls = ["ig-row", pressable ? "ig-row--pressable" : "", rule === "ink" ? "ig-row--ink" : "", ellipsis ? "ig-row--ellipsis" : "", className].filter(Boolean).join(" ");
  const rowStyle = { ...style, ...(indexWidth ? ({ "--ig-index": indexWidth } as CSSProperties) : {}) } as CSSProperties;

  const factsNode =
    facts === undefined || facts === null || facts === false ? null : Array.isArray(facts) ? (
      <MetaLine as="span" tone="secondary" className="ig-row__facts" facts={facts} />
    ) : (
      <span className="ig-row__facts ig-row__facts--sentence paragraph-x-small">{facts}</span>
    );

  const inner = (
    <>
      {hasIndex && <span className="ig-row__index label-small">{index}</span>}
      {hasLeading && <span className="ig-row__leading">{leading}</span>}
      <span className="ig-row__main">
        <TitleTag className="ig-row__title headline-small">{title}</TitleTag>
        {factsNode}
        {factsLine && <MetaLine as="span" tone="secondary" className="ig-row__facts" facts={factsLine} />}
      </span>
      {hasTrailing && (
        <span className="ig-row__end">
          <span className="ig-row__trailing">
            {trailing}
            {chevron && !disabled && <Glyph name="chevron-right" className="ig-row__chevron" />}
          </span>
          {trailingMeta !== undefined && trailingMeta !== null && <span className="ig-row__trailing-meta label-small">{trailingMeta}</span>}
        </span>
      )}
    </>
  );

  const shared = {
    className: cls,
    "data-cols": cols,
    "data-selected": selected ? "true" : undefined,
    "aria-current": current ? ("true" as const) : undefined,
    style: rowStyle,
  };

  let row: ReactNode;
  if (!pressable) {
    row = (
      <div {...shared} aria-disabled={disabled ? "true" : undefined} {...rest}>
        {inner}
      </div>
    );
  } else if (href !== undefined) {
    const anchorRest = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    if (disabled) {
      row = (
        <a role="link" aria-disabled="true" tabIndex={-1} {...shared} {...anchorRest}>
          {inner}
        </a>
      );
    } else if (href.startsWith("/")) {
      row = (
        <Link to={href} {...shared} {...anchorRest} onClick={onPress}>
          {inner}
        </Link>
      );
    } else {
      row = (
        <a href={href} {...shared} {...anchorRest} onClick={onPress}>
          {inner}
        </a>
      );
    }
  } else {
    const buttonRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;
    row = (
      <button type="button" disabled={disabled} {...shared} {...buttonRest} onClick={onPress}>
        {inner}
      </button>
    );
  }

  return <Item className="ig-list__item">{row}</Item>;
}

import { Button } from "@/system/Button/Button";
import { DotGrid, type PatternName } from "@/system/DotGrid/DotGrid";
import { QuietButton } from "@/system/QuietButton/QuietButton";

type EmptyStateProps = {
  title?: string;
  body?: string;
  /** the lit set of the 20px mark; default plus */
  pattern?: PatternName;
  /** one dark Button at most */
  action?: { label: string; onClick?: () => void; href?: string };
  /** the no results form: the body reads No results for "{query}" and the clear button shows */
  query?: string;
  onClear?: () => void;
  /** the quiet form, 16px padding */
  compact?: boolean;
  /** the clear button's label */
  clearLabel?: string;
  className?: string;
};

/** The dashed hairline box with a dot mark: a title and a body, or one mono sentence, and at most one action plus a clear. */
export function EmptyState({ title, body, pattern = "plus", action, query, onClear, compact, clearLabel = "Clear", className }: EmptyStateProps) {
  const cls = ["ig-empty", compact ? "ig-empty--compact" : "", className].filter(Boolean).join(" ");
  const text = query !== undefined && query !== "" ? `No results for "${query}"` : body;
  /* only a body and no title: the single mono sentence ("NO USER REVIEWS") */
  const mono = !title && text !== undefined;
  const showClear = onClear !== undefined;
  const hasActions = action !== undefined || showClear;
  return (
    <div className={cls}>
      <DotGrid size="sm" pattern={pattern} className="ig-empty__mark" />
      {title && <p className="ig-empty__title headline-small">{title}</p>}
      {text !== undefined && <p className={["ig-empty__body", mono ? "ig-empty__body--mono label-small" : "paragraph-x-small"].join(" ")}>{text}</p>}
      {hasActions && (
        <div className="ig-empty__actions">
          {action && (
            <Button variant="dark" hideIcon href={action.href} onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {showClear && <QuietButton onClick={onClear}>{clearLabel}</QuietButton>}
        </div>
      )}
    </div>
  );
}

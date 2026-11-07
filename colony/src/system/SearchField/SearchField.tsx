import { forwardRef } from "react";
import { Glyph } from "@/system/Glyph/Glyph";

type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** names the input (aria-label); there is no visible label on the pill */
  label: string;
  placeholder?: string;
  /** called by the clear button; defaults to onChange("") */
  onClear?: () => void;
  autoFocus?: boolean;
  /** the clear button's accessible name */
  clearLabel?: string;
  className?: string;
};

/** The 52px search pill, one of the three things allowed the 12px radius. forwardRef reaches the input. */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onChange, label, placeholder, onClear, autoFocus, clearLabel = "Clear", className },
  ref,
) {
  const filled = value.length > 0;
  const cls = ["ig-search", className].filter(Boolean).join(" ");
  const clear = () => {
    if (onClear) onClear();
    else onChange("");
  };
  return (
    <label className={cls} data-filled={filled ? "" : undefined}>
      <Glyph name="search" className="ig-search__glyph" />
      <input
        ref={ref}
        type="search"
        className="ig-search__input headline-small"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="search"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && filled) {
            e.preventDefault();
            clear();
          }
        }}
      />
      {filled && (
        <button type="button" className="ig-search__clear" aria-label={clearLabel} onClick={clear}>
          <Glyph name="close" />
        </button>
      )}
    </label>
  );
});

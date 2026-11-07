import { forwardRef, useId, type ForwardedRef, type ReactElement } from "react";
import { Glyph } from "@/system/Glyph/Glyph";

type SelectFieldProps<T extends string> = {
  label: string;
  /** label-small under the box; replaced by error when one is set */
  hint?: string;
  error?: string;
  options: { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (value: T) => void;
  id?: string;
  disabled?: boolean;
  /** keeps the label in the DOM as .ig-sr (a row that already names the field) */
  hideLabel?: boolean;
  /** the native select at opacity 0 over a visible mono value with the chevron; one tap opens the OS picker */
  overlay?: boolean;
  className?: string;
};

function SelectFieldInner<T extends string>(
  { label, hint, error, options, value, onChange, id, disabled, hideLabel, overlay, className }: SelectFieldProps<T>,
  ref: ForwardedRef<HTMLSelectElement>,
) {
  const auto = useId();
  const selectId = id ?? `${auto}-select`;
  const hintId = `${selectId}-hint`;
  const errorId = `${selectId}-error`;
  const invalid = error !== undefined && error !== "";
  const described = invalid ? errorId : hint ? hintId : undefined;
  const current = options.find((o) => o.value === value);

  const cls = ["ig-select", invalid ? "ig-select--error" : "", disabled ? "ig-select--disabled" : "", overlay ? "ig-select--overlay" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls}>
      <label className={["ig-select__label label-small", hideLabel ? "ig-sr" : ""].filter(Boolean).join(" ")} htmlFor={selectId}>
        {label}
      </label>
      <div className="ig-select__box">
        {overlay && (
          /* the visible value; keyed so a change swaps it over the fast duration */
          <span className="ig-select__value label-small" aria-hidden="true" key={value}>
            {current?.label ?? "-"}
          </span>
        )}
        <select
          ref={ref}
          id={selectId}
          className="ig-select__input paragraph-small"
          value={value}
          disabled={disabled}
          aria-invalid={invalid ? "true" : undefined}
          aria-describedby={described}
          onChange={(e) => onChange(e.target.value as T)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <Glyph name="chevron-down" className="ig-select__chevron" />
      </div>
      {invalid ? (
        <p className="ig-select__error label-small" id={errorId} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="ig-select__hint label-small" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** The same underlined box as TextField with a native select and a chevron-down glyph. 16px so iOS never zooms.
 *  forwardRef reaches the select. Generic over the option value. */
export const SelectField = forwardRef(SelectFieldInner) as <T extends string>(
  props: SelectFieldProps<T> & { ref?: ForwardedRef<HTMLSelectElement> },
) => ReactElement;

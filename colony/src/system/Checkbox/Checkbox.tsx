import { useEffect, useId, useRef } from "react";

type CheckboxProps = {
  label: string;
  hint?: string;
  checked: boolean;
  /** the dash: some of a group; the input reports it to assistive tech */
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
};

/** A 16px box with a drawn check or dash over a native checkbox; the whole row is the target (44px, 12px 0). */
export function Checkbox({ label, hint, checked, indeterminate = false, onChange, disabled, id, className }: CheckboxProps) {
  const auto = useId();
  const inputId = id ?? `${auto}-checkbox`;
  const hintId = `${inputId}-hint`;
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  const cls = ["ig-checkbox", disabled ? "ig-checkbox--disabled" : "", className].filter(Boolean).join(" ");
  return (
    <label className={cls} htmlFor={inputId}>
      <span className="ig-checkbox__box">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className="ig-checkbox__input"
          checked={checked}
          disabled={disabled}
          aria-describedby={hint ? hintId : undefined}
          onChange={(e) => onChange(e.target.checked)}
        />
        <svg className="ig-checkbox__mark" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path className="ig-checkbox__check" d="M4 8.5L7 11.5L12 5" />
          <path className="ig-checkbox__dash" d="M4.5 8H11.5" />
        </svg>
      </span>
      <span className="ig-checkbox__text">
        <span className="ig-checkbox__label paragraph-small">{label}</span>
        {hint && (
          <span id={hintId} className="ig-checkbox__hint paragraph-x-small">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

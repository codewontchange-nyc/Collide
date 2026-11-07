import { forwardRef, useId, type ChangeEvent, type InputHTMLAttributes, type ReactNode, type Ref, type TextareaHTMLAttributes } from "react";

type TextFieldProps = {
  /** always rendered above the box; never replaced by the placeholder */
  label: string;
  /** label-small under the box; replaced by error when one is set */
  hint?: string;
  /** sets aria-invalid, the red hairline and the error line (role alert) */
  error?: string;
  /** mono affixes in label-large: a currency sign, a unit */
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** textarea when set */
  rows?: number;
  value?: string;
  defaultValue?: string;
  /** string in, string out */
  onChange?: (value: string) => void;
  id?: string;
  name?: string;
  type?: string;
  placeholder?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  maxLength?: number;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "prefix">;

/** The underlined field: a mono label over a hairline box with a 16px input (no iOS zoom), a hint or an error under it.
 *  forwardRef reaches the input or the textarea. */
export const TextField = forwardRef<HTMLInputElement | HTMLTextAreaElement, TextFieldProps>(function TextField(
  {
    label,
    hint,
    error,
    prefix,
    suffix,
    rows,
    value,
    defaultValue,
    onChange,
    id,
    name,
    type = "text",
    placeholder,
    inputMode,
    autoComplete,
    required,
    disabled,
    readOnly,
    maxLength,
    className,
    "aria-describedby": describedBy,
    ...rest
  },
  ref,
) {
  const auto = useId();
  const inputId = id ?? `${auto}-input`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const invalid = error !== undefined && error !== "";
  const described = [invalid ? errorId : hint ? hintId : undefined, describedBy].filter(Boolean).join(" ") || undefined;

  const cls = ["ig-text-field", invalid ? "ig-text-field--error" : "", disabled ? "ig-text-field--disabled" : "", readOnly ? "ig-text-field--readonly" : "", className]
    .filter(Boolean)
    .join(" ");

  const handle = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange?.(e.target.value);

  const shared = {
    id: inputId,
    name,
    placeholder,
    required,
    disabled,
    readOnly,
    maxLength,
    autoComplete,
    inputMode,
    value,
    defaultValue,
    onChange: handle,
    "aria-invalid": invalid ? ("true" as const) : undefined,
    "aria-describedby": described,
    "aria-required": required ? ("true" as const) : undefined,
    className: "ig-text-field__input paragraph-small",
  };

  return (
    <div className={cls}>
      <label className="ig-text-field__label label-small" htmlFor={inputId}>
        {label}
      </label>
      <div className="ig-text-field__box">
        {prefix !== undefined && prefix !== null && <span className="ig-text-field__affix label-large">{prefix}</span>}
        {rows !== undefined ? (
          <textarea
            ref={ref as Ref<HTMLTextAreaElement>}
            rows={rows}
            {...shared}
            {...(rest as unknown as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input ref={ref as Ref<HTMLInputElement>} type={type} {...shared} {...rest} />
        )}
        {suffix !== undefined && suffix !== null && <span className="ig-text-field__affix label-large">{suffix}</span>}
      </div>
      {invalid ? (
        <p className="ig-text-field__error label-small" id={errorId} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="ig-text-field__hint label-small" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
});

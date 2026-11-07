import { useId } from "react";

type SwitchProps = {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** keeps the label in the DOM as .ig-sr when the row already names it */
  hideLabel?: boolean;
  id?: string;
  className?: string;
};

/** A full width 44px row: the text first, the 36 by 20 track at the right. The track is a button with role switch. */
export function Switch({ label, hint, checked, onChange, disabled, hideLabel, id, className }: SwitchProps) {
  const auto = useId();
  const switchId = id ?? `${auto}-switch`;
  const labelId = `${switchId}-label`;
  const hintId = `${switchId}-hint`;
  const cls = ["ig-switch", disabled ? "ig-switch--disabled" : "", className].filter(Boolean).join(" ");
  return (
    <label className={cls} htmlFor={switchId}>
      <span className="ig-switch__text">
        <span id={labelId} className={["ig-switch__label headline-small", hideLabel ? "ig-sr" : ""].filter(Boolean).join(" ")}>
          {label}
        </span>
        {hint && (
          <span id={hintId} className="ig-switch__hint paragraph-x-small">
            {hint}
          </span>
        )}
      </span>
      <button
        type="button"
        id={switchId}
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={hint ? hintId : undefined}
        className="ig-switch__track"
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="ig-switch__knob" />
      </button>
    </label>
  );
}

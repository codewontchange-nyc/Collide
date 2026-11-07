import type { KeyboardEvent } from "react";
import { Glyph } from "@/system/Glyph/Glyph";

type NumberStepperProps = {
  value: number;
  onChange: (value: number) => void;
  /** default 1 */
  step?: number;
  min?: number;
  max?: number;
  /** the shown value and aria-valuetext; defaults to the number as a string */
  format?: (value: number) => string;
  /** names the group */
  label: string;
  decrementLabel?: string;
  incrementLabel?: string;
  className?: string;
};

/* Round to the step's own precision so 0.1 steps never drift into 0.30000000000000004. */
function precisionOf(step: number): number {
  const s = String(step);
  const i = s.indexOf(".");
  return i < 0 ? 0 : s.length - i - 1;
}

/** Two 44px hairline squares around a tabular figure. The figure is the spinbutton; the buttons are tabindex -1 so one tab stop serves the control. */
export function NumberStepper({ value, onChange, step = 1, min, max, format, label, decrementLabel = "Less", incrementLabel = "More", className }: NumberStepperProps) {
  const fmt = format ?? ((v: number) => String(v));
  const digits = precisionOf(step);
  const clamp = (v: number) => {
    let next = Number(v.toFixed(digits));
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    return next;
  };
  const set = (v: number) => {
    const next = clamp(v);
    if (next !== value) onChange(next);
  };
  const atMin = min !== undefined && value <= min;
  const atMax = max !== undefined && value >= max;

  const onKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    switch (e.key) {
      case "ArrowUp":
      case "ArrowRight":
        set(value + step);
        break;
      case "ArrowDown":
      case "ArrowLeft":
        set(value - step);
        break;
      case "PageUp":
        set(value + step * 10);
        break;
      case "PageDown":
        set(value - step * 10);
        break;
      case "Home":
        if (min !== undefined) set(min);
        break;
      case "End":
        if (max !== undefined) set(max);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const cls = ["ig-stepper-num", className].filter(Boolean).join(" ");
  return (
    <div className={cls} role="group" aria-label={label}>
      <button type="button" className="ig-stepper-num__btn" aria-label={decrementLabel} tabIndex={-1} disabled={atMin} onClick={() => set(value - step)}>
        <Glyph name="minus" />
      </button>
      <span
        className="ig-stepper-num__value headline-small tnum"
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={fmt(value)}
        onKeyDown={onKeyDown}
      >
        {fmt(value)}
      </span>
      <button type="button" className="ig-stepper-num__btn" aria-label={incrementLabel} tabIndex={-1} disabled={atMax} onClick={() => set(value + step)}>
        <Glyph name="plus" />
      </button>
    </div>
  );
}

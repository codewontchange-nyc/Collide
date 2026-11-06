import { motion } from "motion/react";

export function Segmented<T extends string>({ value, options, onChange, id = "seg" }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; id?: string }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.v} type="button" role="tab" aria-selected={o.v === value} className={o.v === value ? "on" : ""} onClick={() => onChange(o.v)}>
          {o.v === value && <motion.span layoutId={`${id}-pill`} className="pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

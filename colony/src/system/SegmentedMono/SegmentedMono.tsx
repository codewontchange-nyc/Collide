import { useRef, type KeyboardEvent } from "react";

/** The FilterBar single facet for time ranges and filters: a hairline row, one segment solid ink. A radiogroup: arrows move the check. */
export function SegmentedMono<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** names the radiogroup, required */
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const cls = ["ig-segmented", className].filter(Boolean).join(" ");
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  const check = (i: number) => {
    const n = options.length;
    const next = ((i % n) + n) % n;
    const option = options[next];
    if (option && option.value !== value) onChange(option.value);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        check(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        check(index - 1);
        break;
      case "Home":
        e.preventDefault();
        check(0);
        break;
      case "End":
        e.preventDefault();
        check(options.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div className={cls} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((option, i) => {
        const checked = i === index;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            className="ig-segmented__item label-small"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => check(i)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

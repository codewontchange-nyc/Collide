type StepsProps = {
  count: number;
  /** one based: "Step 2 of 4" */
  current: number;
  /** track (default): the 4px line the Start wizard uses; dots: the library variant */
  variant?: "track" | "dots";
  /** builds the accessible name; defaults to "Step {current} of {count}" */
  label?: (current: number, count: number) => string;
  className?: string;
};

const defaultLabel = (current: number, count: number) => `Step ${current} of ${count}`;

/** The Start wizard's progress: a 4px track with an ink fill (progressbar), or a row of dots for the library. */
export function Steps({ count, current, variant = "track", label = defaultLabel, className }: StepsProps) {
  const safeCount = Math.max(1, count);
  const now = Math.min(Math.max(1, current), safeCount);
  const name = label(now, safeCount);

  if (variant === "dots") {
    const cls = ["ig-steps", "ig-steps--dots", className].filter(Boolean).join(" ");
    return (
      <ol className={cls} role="img" aria-label={name}>
        {Array.from({ length: safeCount }, (_, i) => {
          const n = i + 1;
          const status = n < now ? "done" : n === now ? "current" : "todo";
          return <li key={n} className="ig-steps__dot" data-status={status} />;
        })}
      </ol>
    );
  }

  const cls = ["ig-steps", "ig-steps--track", className].filter(Boolean).join(" ");
  return (
    <div className={cls} role="progressbar" aria-valuenow={now} aria-valuemin={1} aria-valuemax={safeCount} aria-label={name}>
      <span className="ig-steps__fill" style={{ width: `${(now / safeCount) * 100}%` }} />
    </div>
  );
}

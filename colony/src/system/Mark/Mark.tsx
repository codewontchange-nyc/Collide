import { DotGrid, type GridSize } from "@/system/DotGrid/DotGrid";

/** The colony ring: the perimeter of the dot grid around an empty center (the colony around you), at 20, 44 or 84.
 *  drawIn settles the ring from the dot nearest 12 o'clock, clockwise; under reduced motion it renders at once. */
export function Mark({
  size = "md",
  drawIn = false,
  wordmark = false,
  label = "Colony",
  className,
}: {
  size?: GridSize;
  drawIn?: boolean;
  /** adds the word beside (sm, md) or under (lg) the grid */
  wordmark?: boolean;
  label?: string;
  className?: string;
}) {
  const cls = ["ig-mark", `ig-mark--${size}`, wordmark ? "ig-mark--wordmark" : "", className].filter(Boolean).join(" ");
  return (
    <span className={cls} role="img" aria-label={label}>
      <DotGrid size={size} pattern="colony" unlit="none" settle={drawIn} settleOrder="clockwise" className="ig-mark__grid" />
      {wordmark && (
        <span className="ig-mark__word headline-large" aria-hidden="true">
          Colony
        </span>
      )}
    </span>
  );
}

import type { ReactNode } from "react";

/** One specimen in the library: a stage holding a live render and a mono caption under it.
 *  ground picks the surface the component is meant for: "surface" (default), "ground" (neutral-01) or "inverted" (ink). */
export function Specimen({
  label,
  ground = "surface",
  className,
  children,
}: {
  label: string;
  ground?: "surface" | "ground" | "inverted";
  className?: string;
  children: ReactNode;
}) {
  const cls = ["ig-specimen", ground !== "surface" ? `ig-specimen--${ground}` : "", className].filter(Boolean).join(" ");
  return (
    <figure className={cls}>
      <div className="ig-specimen__stage">{children}</div>
      <figcaption className="ig-specimen__label label-small">{label}</figcaption>
    </figure>
  );
}

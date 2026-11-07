import { useLayoutEffect, useRef, type ReactNode } from "react";

/** The one sticky row: once scrolled past, it sticks at the top of main with the content fading under it, no edge.
 *  It measures its own height into --sticky-height on the scroller so scroll-margin-top can read it. */
export function Sticky({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const scroller = el.closest<HTMLElement>(".ig-main") ?? document.documentElement;
    const write = () => scroller.style.setProperty("--sticky-height", `${Math.round(el.getBoundingClientRect().height)}px`);
    write();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(write);
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      scroller.style.removeProperty("--sticky-height");
    };
  }, []);
  return (
    <div ref={ref} className={["ig-sticky", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

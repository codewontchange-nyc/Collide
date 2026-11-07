import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { motion } from "motion/react";
import type { Variants } from "motion/react";
import { useLocation } from "react-router";
import { screen, useAppear, useReducedMotion } from "@/system/motion";

/* The final frame for reduced motion: the three states with no duration and no lift. */
const still: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
};

const SCROLL_PREFIX = "colony.scroll.";

function readScroll(key: string): number {
  try {
    const raw = sessionStorage.getItem(SCROLL_PREFIX + key);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeScroll(key: string, top: number) {
  try {
    sessionStorage.setItem(SCROLL_PREFIX + key, String(Math.round(top)));
  } catch {
    /* storage can be unavailable; the screen still leaves */
  }
}

/** The page column inside AppShell's one main scroller. Not a main: AppShell renders main.ig-main and the Outlet inside
 *  AnimatePresence mode="wait"; Screen is the .ig-page section that rises in. On mount it restores main.scrollTop
 *  from sessionStorage (scrollKey, default the pathname) or scrolls to 0; before unmount it stores it. */
export function Screen({
  bare = false,
  mode,
  title,
  scrollKey,
  restoreScroll = true,
  children,
  className,
}: {
  /** no tab bar below: welcome and start. Sets --nav-height: var(--safe-bottom) on the element */
  bare?: boolean;
  /** sets data-mode on the screen root (welcome is dark) */
  mode?: "light" | "dark";
  /** document.title suffix ("Budget, Colony") */
  title?: string;
  /** sessionStorage key for scroll restore; defaults to the pathname */
  scrollKey?: string;
  /** library only: false keeps a specimen from scrolling the page it sits on */
  restoreScroll?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const { pathname } = useLocation();
  const key = scrollKey ?? pathname;
  const ref = useRef<HTMLElement>(null);
  const cls = ["ig-page", bare ? "ig-page--bare" : "", className].filter(Boolean).join(" ");
  const style = bare ? ({ "--nav-height": "var(--safe-bottom)" } as CSSProperties) : undefined;

  useEffect(() => {
    if (title === undefined) return;
    const before = document.title;
    document.title = `${title}, Colony`;
    return () => {
      document.title = before;
    };
  }, [title]);

  useLayoutEffect(() => {
    if (!restoreScroll) return;
    const main = ref.current?.closest<HTMLElement>(".ig-main") ?? document.querySelector<HTMLElement>(".ig-main");
    if (!main) return;
    main.scrollTop = readScroll(key);
    return () => {
      writeScroll(key, main.scrollTop);
    };
  }, [key, restoreScroll]);

  return (
    <motion.section ref={ref} className={cls} data-mode={mode} style={style} variants={reduced ? still : screen} initial="hidden" animate="show" exit="exit">
      {children}
    </motion.section>
  );
}

/** The staggered appear wrapper: a screen's panels are Rise children with index so the stagger caps at 240ms. */
export function Rise({
  index = 0,
  as = "div",
  children,
  className,
  style,
}: {
  index?: number;
  as?: "div" | "section";
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const appear = useAppear(index);
  if (as === "section") {
    return (
      <motion.section className={className} style={style} {...appear}>
        {children}
      </motion.section>
    );
  }
  return (
    <motion.div className={className} style={style} {...appear}>
      {children}
    </motion.div>
  );
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Navigate, useLocation, useOutlet } from "react-router";
import { motion } from "motion/react";
import { useColonyState } from "@/store/store";
import { TabBar, MEMBER_TABS, PROVIDER_TABS, ToastHost, dur, ease, useReducedMotion } from "@/system";
import { SheetHost } from "@/sheets/SheetHost";
import { UpdateToast } from "./UpdateToast";

const BARE = /^\/(welcome|start|system)(\/|$)/;
const routeKeyOf = (pathname: string) => `/${pathname.split("/")[1] ?? ""}`;

/** The route change, keyed by the first path segment: the shown screen fades out over the short exit, then the next one mounts
 *  and rises in on its own (Screen's 480ms). A navigation inside the same key (/start/1 to /start/2) swaps the outlet in place,
 *  so a screen keeps its state. One thing at a time, and nothing slides sideways. */
function RouteSwitch({ routeKey, outlet }: { routeKey: string; outlet: ReactNode }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState({ key: routeKey, outlet });
  const [leaving, setLeaving] = useState(false);
  const pending = useRef<{ key: string; outlet: ReactNode } | null>(null);

  useEffect(() => {
    if (routeKey === display.key) {
      pending.current = null;
      setLeaving(false);
      setDisplay((d) => (d.outlet === outlet ? d : { key: routeKey, outlet }));
    } else {
      pending.current = { key: routeKey, outlet };
      setLeaving(true);
    }
  }, [routeKey, outlet, display.key]);

  const swap = () => {
    if (!pending.current) return;
    setDisplay(pending.current);
    pending.current = null;
    setLeaving(false);
  };

  return (
    <motion.div
      key={display.key}
      className="ig-route"
      initial={false}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={leaving && !reduced ? { duration: dur.exitShort, ease: ease.exit } : { duration: 0 }}
      onAnimationComplete={() => {
        if (leaving) swap();
      }}
    >
      {display.outlet}
    </motion.div>
  );
}

/** The frame: the guard, one main scroller holding the route, the right tab bar for the persona, and the hosts as siblings
 *  of main. /welcome, /start and /system are bare: no tab bar, no guard, and fixed chrome reads the safe inset alone as --nav-height. */
export function AppShell() {
  const state = useColonyState();
  const loc = useLocation();
  const outlet = useOutlet();
  const bare = BARE.test(loc.pathname);
  const providerMode = loc.pathname.startsWith("/provider");
  const routeKey = routeKeyOf(loc.pathname);

  /* Needs' count on the bar: tasks waiting on a choice plus needs waiting on a pick. */
  const youCount = useMemo(
    () => state.tasks.filter((t) => t.status === "needs_you").length + state.needs.filter((n) => n.status === "matched" || n.status === "matching").length,
    [state.tasks, state.needs],
  );
  const tabs = useMemo(() => (providerMode ? PROVIDER_TABS : MEMBER_TABS.map((t) => (t.to === "/needs" ? { ...t, count: youCount } : t))), [providerMode, youCount]);

  /* Fixed chrome (the toast host) reads --nav-height from the root; a bare route has no bar under it. */
  useEffect(() => {
    const root = document.documentElement;
    if (bare) root.style.setProperty("--nav-height", "var(--safe-bottom)");
    else root.style.removeProperty("--nav-height");
    return () => {
      root.style.removeProperty("--nav-height");
    };
  }, [bare]);

  if (!state.meta.onboarded && !bare) return <Navigate to="/welcome" replace />;

  return (
    <>
      <main className={bare ? "ig-main ig-main--bare" : "ig-main"}>
        <RouteSwitch routeKey={routeKey} outlet={outlet} />
      </main>
      {!bare && <TabBar tabs={tabs} />}
      <SheetHost />
      <ToastHost />
      <UpdateToast />
    </>
  );
}

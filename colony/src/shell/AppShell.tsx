import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { useColonyState } from "@/store/store";
import { MEMBER_TABS, PROVIDER_TABS, Tabs } from "./Tabs";
import { SheetHost } from "@/sheets/SheetHost";
import { ToastHost } from "@/ui/Toast";
import { ToastHost as SystemToastHost } from "@/system/Toast/Toast";
import { UpdateToast } from "./UpdateToast";

/** The frame: guard, a fresh screen per route (each one rises in), the right tab bar for the persona, and the hosts.
 *  /system is bare like /welcome and /start (no tab bar, no guard) and, until the restyle pass, gets the system's main scroller and toast host here. */
export function AppShell() {
  const state = useColonyState();
  const loc = useLocation();
  const onWelcome = loc.pathname.startsWith("/welcome") || loc.pathname.startsWith("/start");
  const onSystem = loc.pathname.startsWith("/system");
  const bare = onWelcome || onSystem;
  const routeKey = loc.pathname.split("/").slice(0, 2).join("/");
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [routeKey]);
  if (!state.meta.onboarded && !bare) return <Navigate to="/welcome" replace />;
  const providerMode = loc.pathname.startsWith("/provider");
  return (
    <div className="app">
      {onSystem ? (
        <main className="ig-main ig-main--bare">
          <Outlet key={routeKey} />
        </main>
      ) : (
        <Outlet key={routeKey} />
      )}
      {!bare && <Tabs tabs={providerMode ? PROVIDER_TABS : MEMBER_TABS} id={providerMode ? "pro" : "member"} />}
      <SheetHost />
      {onSystem ? <SystemToastHost /> : <ToastHost />}
      <UpdateToast />
    </div>
  );
}

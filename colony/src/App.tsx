import { createBrowserRouter, RouterProvider } from "react-router";
import { MotionConfig } from "motion/react";
import { StoreProvider } from "@/store/StoreProvider";
import { AppShell } from "@/shell/AppShell";
import { Welcome } from "@/screens/Welcome";
import { Start } from "@/screens/Start";
import { Home } from "@/screens/Home";
import { Budget } from "@/screens/Budget";
import { Needs } from "@/screens/Needs";
import { ColonyScreen } from "@/screens/Colony";
import { You } from "@/screens/You";
import { Membership } from "@/screens/Membership";
import { Today } from "@/screens/provider/Today";
import { Earnings } from "@/screens/provider/Earnings";
import { Availability } from "@/screens/provider/Availability";
import { Screen, Mark } from "@/system";
import { SystemLibrary } from "@/system/library/SystemLibrary";
import "./App.css";

/** While the store hydrates: the ring drawing in, centered, and nothing else. No text, no spinner. */
function Boot() {
  return (
    <Screen bare className="boot" restoreScroll={false}>
      <Mark size="md" drawIn />
    </Screen>
  );
}

/* The store sits inside the router so Boot, a Screen, has the router context the way every screen does. */
const router = createBrowserRouter(
  [
    {
      element: (
        <StoreProvider fallback={<Boot />}>
          <AppShell />
        </StoreProvider>
      ),
      children: [
        { path: "/welcome", element: <Welcome /> },
        { path: "/start/:step?", element: <Start /> },
        { path: "/", element: <Home /> },
        { path: "/budget", element: <Budget /> },
        { path: "/needs", element: <Needs /> },
        { path: "/colony", element: <ColonyScreen /> },
        { path: "/you", element: <You /> },
        { path: "/you/membership", element: <Membership /> },
        { path: "/provider", element: <Today /> },
        { path: "/provider/earnings", element: <Earnings /> },
        { path: "/provider/availability", element: <Availability /> },
        { path: "/system", element: <SystemLibrary /> },
        { path: "*", element: <Home /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" },
);

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  );
}

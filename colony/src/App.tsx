import { createBrowserRouter, RouterProvider } from "react-router";
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
import { Mark } from "@/brand/Mark";
import { SystemLibrary } from "@/system/library/SystemLibrary";

const router = createBrowserRouter(
  [
    {
      element: <AppShell />,
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

function Boot() {
  return (
    <div className="app" style={{ display: "grid", placeItems: "center", minHeight: "100dvh", color: "var(--ink)" }}>
      <Mark size={40} drawIn />
    </div>
  );
}

export function App() {
  return (
    <StoreProvider fallback={<Boot />}>
      <RouterProvider router={router} />
    </StoreProvider>
  );
}

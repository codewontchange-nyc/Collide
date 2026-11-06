import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "@/ui/Toast";

const POLL_MS = 15 * 60 * 1000;

/** Collide's update rhythm: check every 15 minutes and when the app comes back; ask in the open, apply quietly when hidden. */
export function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, r) {
      if (!r) return;
      setInterval(() => r.update().catch(() => {}), POLL_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") r.update().catch(() => {});
      });
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    if (document.visibilityState === "hidden") {
      void updateServiceWorker(true);
      return;
    }
    const id = toast.show("A fresh Colony is ready.", {
      sticky: true,
      action: { label: "Update", onClick: () => void updateServiceWorker(true) },
    });
    return () => {
      toast.dismiss(id);
      setNeedRefresh(false);
    };
  }, [needRefresh, updateServiceWorker, setNeedRefresh]);

  return null;
}

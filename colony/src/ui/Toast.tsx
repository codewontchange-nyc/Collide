import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";

interface ToastItem { id: number; text: string; action?: { label: string; onClick: () => void }; sticky?: boolean }
let items: ToastItem[] = [];
let seq = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((fn) => fn());

export const toast = {
  show(text: string, opts: { action?: ToastItem["action"]; sticky?: boolean; ms?: number } = {}) {
    const id = ++seq;
    items = [...items.filter((t) => !t.sticky || t.text !== text), { id, text, action: opts.action, sticky: opts.sticky }];
    emit();
    if (!opts.sticky) setTimeout(() => toast.dismiss(id), opts.ms ?? 2400);
    return id;
  },
  dismiss(id: number) {
    items = items.filter((t) => t.id !== id);
    emit();
  },
};
const get = () => items;
const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
};

export function ToastHost() {
  const list = useSyncExternalStore(subscribe, get, get);
  return (
    <div className="toast-host" aria-live="polite">
      <AnimatePresence>
        {list.map((t) => (
          <motion.div key={t.id} className="toast" initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ type: "spring", stiffness: 320, damping: 26 }}>
            <span>{t.text}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  toast.dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

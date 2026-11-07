/* The portal target store shared by ToastHost, Companion and Sheet.
   A native modal dialog sits in the top layer above every z-index, so anything that must show while a
   sheet is open portals into the open sheet's overlay slot. The Sheet registers its .ig-sheet__overlay
   element on open and clears it on close; hosts render through createPortal into useOverlaySlot() ?? document.body. */
import { useSyncExternalStore } from "react";

let current: HTMLElement | null = null;
const subs = new Set<() => void>();

export const overlaySlot = {
  /** Register the element that overlays should portal into, or null to fall back to the body. */
  set(el: HTMLElement | null) {
    if (el === current) return;
    current = el;
    subs.forEach((fn) => fn());
  },
  get(): HTMLElement | null {
    return current;
  },
  subscribe(fn: () => void): () => void {
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  },
};

const getServer = () => null;

/** The current overlay element, or null when no sheet is open. */
export function useOverlaySlot(): HTMLElement | null {
  return useSyncExternalStore(overlaySlot.subscribe, overlaySlot.get, getServer);
}

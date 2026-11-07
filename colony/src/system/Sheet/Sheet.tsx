import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type AnimationEvent,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";
import { IconButton } from "@/system/IconButton/IconButton";
import { Kicker } from "@/system/Kicker/Kicker";
import { dur } from "@/system/motion";
import { overlaySlot } from "@/system/Toast/overlaySlot";

type Mode = "light" | "dark";

/* What SheetContent hands the parent: the DOM slots it portals into and the setters for the dialog's own attributes. */
interface SheetSlots {
  head: HTMLElement | null;
  actions: HTMLElement | null;
  setLabelledBy: (id: string | null) => void;
  setDismissable: (v: boolean | null) => void;
  setMode: (v: Mode | null) => void;
}
const SheetContext = createContext<SheetSlots | null>(null);

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type SheetProps = {
  /** SheetHost passes !!spec */
  open: boolean;
  /** SheetHost passes sheets.close */
  onClose: () => void;
  title?: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** the fixed action row: one or two Buttons (dark hideIcon, grey hideIcon "Not now"), each flex 1 */
  actions?: ReactNode;
  /** the manifesto sheet is dark: data-mode on the dialog */
  mode?: Mode;
  closeLabel?: string;
  /** false hides the close button and ignores Escape and scrim taps */
  dismissable?: boolean;
  /** when the title is rendered by the child */
  labelledBy?: string;
  children: ReactNode;
  className?: string;
};

function Eyebrow({ children }: { children: ReactNode }) {
  if (typeof children === "string" || typeof children === "number") return <Kicker tone="meta" className="ig-sheet__eyebrow">{children}</Kicker>;
  return <div className="ig-sheet__eyebrow">{children}</div>;
}

/** The bottom sheet: a native modal dialog that rises on the feature reveal curve and leaves on exit. No drag, no handle.
 *  Four ways out: the close button, the scrim, Escape, hardware back (the store's popstate). Swaps do not re animate. */
export const Sheet = forwardRef<HTMLDialogElement, SheetProps>(function Sheet(
  { open, onClose, title, eyebrow, description, actions, mode, closeLabel = "Close", dismissable = true, labelledBy, children, className },
  ref,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closing = useRef(false);
  const ownTitleId = useId();
  const [headEl, setHeadEl] = useState<HTMLElement | null>(null);
  const [actionsEl, setActionsEl] = useState<HTMLElement | null>(null);
  const [childLabelledBy, setChildLabelledBy] = useState<string | null>(null);
  const [childDismissable, setChildDismissable] = useState<boolean | null>(null);
  const [childMode, setChildMode] = useState<Mode | null>(null);
  useImperativeHandle(ref, () => dialogRef.current as HTMLDialogElement, []);

  const canDismiss = childDismissable ?? dismissable;
  const effectiveMode = childMode ?? mode;
  const hasTitle = title !== undefined && title !== null && title !== false;
  const ariaLabelledBy = labelledBy ?? childLabelledBy ?? (hasTitle ? ownTitleId : undefined);

  const finishClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (closeTimer.current !== undefined) {
      clearTimeout(closeTimer.current);
      closeTimer.current = undefined;
    }
    closing.current = false;
    if (dialog) {
      dialog.removeAttribute("data-closing");
      if (dialog.open) dialog.close();
    }
    overlaySlot.set(null);
  }, []);

  /* open: showModal, focus the first focusable in the body (else the close button), register the overlay slot.
     close: mark data-closing, let ig-sheet-out run, then close the dialog on animationend or after 260ms, whichever first. */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (closeTimer.current !== undefined) {
        clearTimeout(closeTimer.current);
        closeTimer.current = undefined;
      }
      closing.current = false;
      dialog.removeAttribute("data-closing");
      if (!dialog.open) dialog.showModal();
      overlaySlot.set(overlayRef.current);
      const body = dialog.querySelector<HTMLElement>(".ig-sheet__body");
      const first = body?.querySelector<HTMLElement>(FOCUSABLE) ?? dialog.querySelector<HTMLElement>(".ig-sheet__close");
      first?.focus({ preventScroll: true });
      return;
    }
    if (dialog.open && !closing.current) {
      closing.current = true;
      dialog.setAttribute("data-closing", "true");
      closeTimer.current = setTimeout(finishClose, dur.exitShort * 1000 + 20);
    }
  }, [open, finishClose]);

  useEffect(() => () => finishClose(), [finishClose]);

  const onAnimationEnd = (e: AnimationEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current && e.animationName === "ig-sheet-out" && closing.current) finishClose();
  };

  const onCancel = (e: SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    if (canDismiss && open) onClose();
  };

  const onDialogClose = () => {
    /* the browser closed it on its own (a close watcher, a form method="dialog"): keep the store in step */
    if (open && !closing.current) onClose();
  };

  const onScrimClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current && canDismiss && open) onClose();
  };

  const slots: SheetSlots = {
    head: headEl,
    actions: actionsEl,
    setLabelledBy: setChildLabelledBy,
    setDismissable: setChildDismissable,
    setMode: setChildMode,
  };

  const cls = ["ig-sheet", className].filter(Boolean).join(" ");
  return (
    <dialog
      ref={dialogRef}
      className={cls}
      data-mode={effectiveMode}
      aria-labelledby={ariaLabelledBy}
      onCancel={onCancel}
      onClose={onDialogClose}
      onClick={onScrimClick}
      onAnimationEnd={onAnimationEnd}
    >
      <SheetContext.Provider value={slots}>
        <div className="ig-sheet__panel">
          <div className="ig-sheet__head" ref={setHeadEl}>
            {eyebrow !== undefined && eyebrow !== null && eyebrow !== false && <Eyebrow>{eyebrow}</Eyebrow>}
            {hasTitle && (
              <h2 className="ig-sheet__title headline-medium" id={ownTitleId}>
                {title}
              </h2>
            )}
            {description !== undefined && description !== null && description !== false && <p className="ig-sheet__description paragraph-small">{description}</p>}
          </div>
          {canDismiss && <IconButton icon="close" label={closeLabel} className="ig-sheet__close" onClick={onClose} />}
          <div className="ig-sheet__body">{children}</div>
          <div className="ig-sheet__actions" ref={setActionsEl}>
            {actions}
          </div>
        </div>
        <div className="ig-sheet__overlay" data-overlay-slot ref={overlayRef} />
      </SheetContext.Provider>
    </dialog>
  );
});

/** What each sheet component renders: its head and action row go to the parent Sheet's slots through portals, so a sheet
 *  file keeps its current shape. Props mirror the Sheet's own. */
export function SheetContent({
  eyebrow,
  title,
  description,
  actions,
  dismissable = true,
  mode,
  children,
}: {
  /** a Kicker or a MetaLine (tone meta), one line, ellipsis */
  eyebrow?: ReactNode;
  /** headline-medium; omit for the request sheet's curating body */
  title?: ReactNode;
  description?: ReactNode;
  /** one or two Buttons; each gets flex 1 */
  actions?: ReactNode;
  /** forwarded to the Sheet while this content is mounted */
  dismissable?: boolean;
  /** forwarded to the Sheet (the manifesto) */
  mode?: Mode;
  children: ReactNode;
}) {
  const slots = useContext(SheetContext);
  const titleId = useId();
  const hasTitle = title !== undefined && title !== null && title !== false;

  useEffect(() => {
    if (!slots) return;
    slots.setLabelledBy(hasTitle ? titleId : null);
    return () => slots.setLabelledBy(null);
  }, [slots, hasTitle, titleId]);
  useEffect(() => {
    if (!slots) return;
    slots.setDismissable(dismissable);
    return () => slots.setDismissable(null);
  }, [slots, dismissable]);
  useEffect(() => {
    if (!slots) return;
    slots.setMode(mode ?? null);
    return () => slots.setMode(null);
  }, [slots, mode]);

  const head = (
    <>
      {eyebrow !== undefined && eyebrow !== null && eyebrow !== false && <Eyebrow>{eyebrow}</Eyebrow>}
      {hasTitle && (
        <h2 className="ig-sheet__title headline-medium" id={titleId}>
          {title}
        </h2>
      )}
      {description !== undefined && description !== null && description !== false && <p className="ig-sheet__description paragraph-small">{description}</p>}
    </>
  );
  const hasActions = actions !== undefined && actions !== null && actions !== false;

  if (!slots) {
    /* outside a Sheet (a test, a specimen): render the shape in place */
    return (
      <div className="ig-sheet__content">
        <div className="ig-sheet__head">{head}</div>
        <div className="ig-sheet__body">{children}</div>
        {hasActions && <div className="ig-sheet__actions">{actions}</div>}
      </div>
    );
  }
  return (
    <>
      {slots.head && createPortal(head, slots.head)}
      {children}
      {hasActions && slots.actions && createPortal(actions, slots.actions)}
    </>
  );
}

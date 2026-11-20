"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/utils/cn";
import { Card } from "./Card";
import {
  createScrollLock,
  getDialogStack,
  isTopDialog,
  nextTrapIndex,
  pushDialog,
  removeDialog,
  subscribeDialogStack,
} from "./dialog-logic";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /**
   * Destructive confirmations (delete, remove access) must not be dismissed by a
   * stray click outside the panel (DES-012). Escape and the close button still
   * cancel, because cancelling is always safe.
   */
  destructive?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0 && !el.closest("[inert]"),
  );
}

const scrollLock = createScrollLock();

// Accessible modal (Document 2 section 10): role=dialog + aria-modal, labelled by its title and
// described by its description, focus moves in on open and returns to the trigger on close, Tab is
// trapped, Escape closes, outside click closes unless `destructive`, background scroll is locked,
// and only the topmost of stacked dialogs is interactive. Rendered in a portal on <body>.
export function Dialog({ open, onClose, title, description, children, className, destructive = false }: DialogProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const [mounted, setMounted] = useState(false);

  // Keep the latest onClose without re-running the open/close effects when callers pass inline functions.
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const stack = useSyncExternalStore(subscribeDialogStack, getDialogStack, getDialogStack);
  const isTop = stack.includes(id) ? isTopDialog(id) : true;

  // Open/close lifecycle: register, lock scroll, move focus in, and give it back on close.
  useEffect(() => {
    if (!open || !mounted) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pushDialog(id);
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    scrollLock.lock(document.body, scrollbar);

    const panel = panelRef.current;
    const inBody = bodyRef.current ? focusableIn(bodyRef.current) : [];
    const first = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? inBody[0] ?? (panel ? focusableIn(panel)[0] : undefined);
    (first ?? panel)?.focus();

    return () => {
      removeDialog(id);
      scrollLock.unlock(document.body);
      // Deferred one tick: when this dialog sat on top of another, the trigger lives in a
      // dialog that is still inert until React commits the stack change. Skipped if this
      // dialog re-opened meanwhile (React StrictMode re-runs effects in development).
      window.setTimeout(() => {
        if (getDialogStack().includes(id)) return;
        if (trigger && trigger.isConnected) trigger.focus();
      }, 0);
    };
  }, [open, mounted, id]);

  // Escape (topmost only) and the Tab trap.
  useEffect(() => {
    if (!open || !mounted) return;
    function onKeyDown(e: KeyboardEvent) {
      if (!isTopDialog(id)) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = focusableIn(panelRef.current);
      if (items.length === 0) {
        e.preventDefault();
        panelRef.current.focus();
        return;
      }
      const active = items.indexOf(document.activeElement as HTMLElement);
      const target = nextTrapIndex(active, items.length, e.shiftKey);
      if (target !== null) {
        e.preventDefault();
        items[target]?.focus();
      }
    }
    // Keep focus inside if something moves it out (for example a click on the page behind).
    function onFocusIn(e: FocusEvent) {
      const panel = panelRef.current;
      if (!panel || !isTopDialog(id)) return;
      if (e.target instanceof Node && !panel.contains(e.target)) (focusableIn(panel)[0] ?? panel).focus();
    }
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open, mounted, id]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      // A dialog covered by a newer one cannot be reached by keyboard, pointer or screen reader.
      inert={!isTop}
    >
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={destructive ? undefined : () => closeRef.current()}
        aria-hidden="true"
        data-testid="dialog-backdrop"
      />
      <Card
        ref={panelRef}
        variant="glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn("relative z-10 max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto outline-none", className)}
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-0">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => closeRef.current()}
            aria-label={`Close dialog: ${title}`}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <div ref={bodyRef} className="p-6">
          {children}
        </div>
      </Card>
    </div>,
    document.body,
  );
}

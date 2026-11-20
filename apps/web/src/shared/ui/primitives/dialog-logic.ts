// Pure logic behind <Dialog>, kept free of React and the DOM so it can be unit
// tested without jsdom or Testing Library (neither is installed).

/**
 * Where Tab / Shift+Tab should go inside a focus trap.
 * @param active index of the focused element among the trap's focusable
 *   elements, or -1 when focus is outside them (for example on the panel itself).
 * @returns the index to focus, or null to let the browser move focus normally.
 */
export function nextTrapIndex(active: number, count: number, backwards: boolean): number | null {
  if (count <= 0) return null;
  if (active < 0) return backwards ? count - 1 : 0;
  if (!backwards && active === count - 1) return 0;
  if (backwards && active === 0) return count - 1;
  return null;
}

// ---- Stack of open dialogs: only the topmost one is interactive (Document 2 section 10:
// "one dialog open at a time"). A dialog opened over another covers it; the covered
// one is made inert and ignores Escape until the top one closes.

let stack: readonly string[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function pushDialog(id: string) {
  if (stack.includes(id)) return;
  stack = [...stack, id];
  emit();
}

export function removeDialog(id: string) {
  if (!stack.includes(id)) return;
  stack = stack.filter((s) => s !== id);
  emit();
}

export function isTopDialog(id: string): boolean {
  return stack[stack.length - 1] === id;
}

export function subscribeDialogStack(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDialogStack() {
  return stack;
}

// ---- Background scroll lock, reference counted so stacked dialogs do not unlock early.

interface LockTarget {
  style: { overflow: string; paddingRight: string };
}

export function createScrollLock() {
  let count = 0;
  let saved = { overflow: "", paddingRight: "" };

  return {
    lock(target: LockTarget, scrollbarWidth: number) {
      if (count === 0) {
        saved = { overflow: target.style.overflow, paddingRight: target.style.paddingRight };
        target.style.overflow = "hidden";
        if (scrollbarWidth > 0) target.style.paddingRight = `${scrollbarWidth}px`;
      }
      count += 1;
    },
    unlock(target: LockTarget) {
      if (count === 0) return;
      count -= 1;
      if (count === 0) {
        target.style.overflow = saved.overflow;
        target.style.paddingRight = saved.paddingRight;
      }
    },
    get count() {
      return count;
    },
  };
}

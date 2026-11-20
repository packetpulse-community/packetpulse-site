import { beforeEach, describe, expect, it } from "vitest";
import {
  createScrollLock,
  getDialogStack,
  isTopDialog,
  nextTrapIndex,
  pushDialog,
  removeDialog,
  subscribeDialogStack,
} from "./dialog-logic";

describe("nextTrapIndex (focus trap)", () => {
  it("wraps forward from the last element to the first", () => {
    expect(nextTrapIndex(2, 3, false)).toBe(0);
  });
  it("wraps backward from the first element to the last", () => {
    expect(nextTrapIndex(0, 3, true)).toBe(2);
  });
  it("lets the browser handle Tab in the middle", () => {
    expect(nextTrapIndex(1, 3, false)).toBeNull();
    expect(nextTrapIndex(1, 3, true)).toBeNull();
  });
  it("pulls focus in when it is outside the trap", () => {
    expect(nextTrapIndex(-1, 3, false)).toBe(0);
    expect(nextTrapIndex(-1, 3, true)).toBe(2);
  });
  it("handles a single focusable element and none", () => {
    expect(nextTrapIndex(0, 1, false)).toBe(0);
    expect(nextTrapIndex(0, 1, true)).toBe(0);
    expect(nextTrapIndex(-1, 0, false)).toBeNull();
  });
});

describe("dialog stack (one interactive dialog at a time)", () => {
  beforeEach(() => {
    [...getDialogStack()].forEach(removeDialog);
  });

  it("makes only the most recently opened dialog the top", () => {
    pushDialog("a");
    pushDialog("b");
    expect(isTopDialog("a")).toBe(false);
    expect(isTopDialog("b")).toBe(true);
  });
  it("hands the top back when the upper dialog closes", () => {
    pushDialog("a");
    pushDialog("b");
    removeDialog("b");
    expect(isTopDialog("a")).toBe(true);
  });
  it("ignores duplicate pushes and unknown removals", () => {
    pushDialog("a");
    pushDialog("a");
    removeDialog("zzz");
    expect(getDialogStack()).toEqual(["a"]);
  });
  it("notifies subscribers on change only", () => {
    let calls = 0;
    const off = subscribeDialogStack(() => (calls += 1));
    pushDialog("a");
    pushDialog("a");
    removeDialog("a");
    off();
    pushDialog("b");
    expect(calls).toBe(2);
  });
});

describe("createScrollLock", () => {
  it("locks once, restores the original styles after the last unlock", () => {
    const body = { style: { overflow: "auto", paddingRight: "4px" } };
    const lock = createScrollLock();
    lock.lock(body, 15);
    expect(body.style).toEqual({ overflow: "hidden", paddingRight: "15px" });
    lock.lock(body, 15);
    lock.unlock(body);
    expect(body.style.overflow).toBe("hidden");
    lock.unlock(body);
    expect(body.style).toEqual({ overflow: "auto", paddingRight: "4px" });
    expect(lock.count).toBe(0);
  });
  it("does not add padding when there is no scrollbar and ignores extra unlocks", () => {
    const body = { style: { overflow: "", paddingRight: "" } };
    const lock = createScrollLock();
    lock.lock(body, 0);
    expect(body.style.paddingRight).toBe("");
    lock.unlock(body);
    lock.unlock(body);
    expect(lock.count).toBe(0);
  });
});

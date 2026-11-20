import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./http-client";
import { applyServerFormError, mapServerFormError } from "./form-errors";

const validation = (fields: { path: string; message: string }[]) =>
  new ApiError(400, { statusCode: 400, code: "VALIDATION_FAILED", message: "Validation failed", fields });

describe("mapServerFormError", () => {
  it("places known fields inline and keeps the first message per field", () => {
    const err = validation([
      { path: "title", message: "Too short" },
      { path: "title", message: "Second" },
      { path: "tags", message: "Too many" },
    ]);
    expect(mapServerFormError(err, ["title", "tags"], "x")).toEqual({
      fields: { title: "Too short", tags: "Too many" },
      root: "",
    });
  });

  it("maps nested paths to their leading known field", () => {
    const err = validation([{ path: "profile.bio", message: "Too long" }]);
    expect(mapServerFormError(err, ["profile"], "x").fields).toEqual({ profile: "Too long" });
  });

  it("sends unknown paths to the root message instead of dropping them", () => {
    const err = validation([{ path: "secret", message: "Bad" }]);
    expect(mapServerFormError(err, ["title"], "x")).toEqual({ fields: {}, root: "Bad" });
  });

  it("uses the body message when there are no fields, then the fallback", () => {
    expect(mapServerFormError(new ApiError(409, { message: "Slug taken" }), ["title"], "x").root).toBe("Slug taken");
    expect(mapServerFormError(new ApiError(500, null), ["title"], "Could not save").root).toBe("Could not save");
    expect(mapServerFormError(new Error("boom"), ["title"], "Could not save").root).toBe("Could not save");
  });
});

describe("applyServerFormError", () => {
  it("focuses only the first field and sets root only when needed", () => {
    const setError = vi.fn();
    applyServerFormError(setError, validation([{ path: "a", message: "A" }, { path: "b", message: "B" }]), ["a", "b"], "x");
    expect(setError).toHaveBeenCalledTimes(2);
    expect(setError).toHaveBeenNthCalledWith(1, "a", { message: "A" }, { shouldFocus: true });
    expect(setError).toHaveBeenNthCalledWith(2, "b", { message: "B" }, { shouldFocus: false });
  });

  it("sets root for a plain error", () => {
    const setError = vi.fn();
    applyServerFormError(setError, new Error("x"), ["a"], "Could not save");
    expect(setError).toHaveBeenCalledWith("root", { message: "Could not save" });
  });
});

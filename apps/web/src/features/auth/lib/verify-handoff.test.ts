import { describe, expect, it } from "vitest";
import { secondsFromWaitMessage } from "./verify-handoff";

describe("secondsFromWaitMessage", () => {
  it("reads the wait from the server message", () => {
    expect(secondsFromWaitMessage("Please wait 42 seconds before asking for another code.", 60)).toBe(42);
  });
  it("falls back when the message names no wait (hourly cap, lockout)", () => {
    expect(secondsFromWaitMessage("Too many codes requested. Please try again in an hour.", 60)).toBe(60);
    expect(secondsFromWaitMessage(undefined, 60)).toBe(60);
  });
});

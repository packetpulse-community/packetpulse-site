import { describe, expect, it } from "vitest";
import { readSessionHint } from "./session-hint";

describe("readSessionHint", () => {
  it("is signed-in when the presence cookie is set", () => {
    expect(readSessionHint("session_active=true")).toBe("signed-in");
    expect(readSessionHint("theme=dark; session_active=true; other=1")).toBe("signed-in");
  });

  it("is signed-out when it is missing or not 'true'", () => {
    expect(readSessionHint("")).toBe("signed-out");
    expect(readSessionHint("theme=dark")).toBe("signed-out");
    expect(readSessionHint("session_active=false")).toBe("signed-out");
  });

  it("does not match a similarly named cookie", () => {
    expect(readSessionHint("not_session_active=true")).toBe("signed-out");
    expect(readSessionHint("session_active_old=true")).toBe("signed-out");
  });
});

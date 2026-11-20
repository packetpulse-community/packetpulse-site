"use client";

import { useEffect } from "react";
import { refreshSession } from "@/shared/api/http-client";
import { KeepAlive } from "./session-keep-alive";
import { readSessionHint } from "./session-hint";

// Renews the session about every 10 minutes while this tab is visible, so the 15-minute access
// cookie does not lapse under someone still reading (cost: one extra POST /api/auth/refresh per
// active tab per 10 minutes). Renders nothing, shows nothing on failure and never redirects:
// the next navigation handles an expired session. Does nothing when no session cookie is present.
export function SessionKeepAlive() {
  useEffect(() => {
    const keepAlive = new KeepAlive({
      refresh: refreshSession,
      shouldRun: () => readSessionHint(document.cookie) === "signed-in",
      isVisible: () => document.visibilityState === "visible",
      now: () => Date.now(),
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: (h) => window.clearTimeout(h as number),
    });
    const onVisibility = () => keepAlive.onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibility);
    keepAlive.start();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      keepAlive.stop();
    };
  }, []);
  return null;
}

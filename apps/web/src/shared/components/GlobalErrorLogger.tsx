"use client";

import { useEffect } from "react";
import { logClientEvent } from "@/shared/utils/clientLogger";

// Captures uncaught browser errors and unhandled promise rejections and ships
// them to the admin-viewable log pipeline — mirrors the legacy app's client-log
// ingestion, so the Logs Viewer has real data instead of staying empty.
export function GlobalErrorLogger() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      logClientEvent({
        level: "error",
        context: "window.onerror",
        message: event.message,
        data: { source: event.filename, lineno: event.lineno, colno: event.colno },
      });
    }
    function handleRejection(event: PromiseRejectionEvent) {
      logClientEvent({
        level: "error",
        context: "unhandledrejection",
        message: String(event.reason?.message ?? event.reason ?? "Unhandled promise rejection"),
      });
    }
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}

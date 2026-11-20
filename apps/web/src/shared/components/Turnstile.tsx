"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Cloudflare Turnstile (TASK-013 bot protection). Renders nothing — and loads nothing from
// Cloudflare — unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, so forms behave exactly as before
// until the owner opts in. Needs https://challenges.cloudflare.com in the CSP once it is enforced.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;
function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
    s.onerror = () => reject(new Error("turnstile failed to load"));
    document.head.appendChild(s);
  }).catch((err) => {
    scriptPromise = null; // allow a retry after a network failure
    throw err;
  });
  return scriptPromise;
}

/** Holds the token for one form. `reset()` gets a fresh challenge (tokens are single-use). */
export function useCaptcha() {
  const [token, setToken] = useState<string | undefined>(undefined);
  const [resetKey, setResetKey] = useState(0);
  const reset = useCallback(() => {
    setToken(undefined);
    setResetKey((k) => k + 1);
  }, []);
  return { enabled: SITE_KEY !== "", token, setToken, resetKey, reset };
}

type CaptchaState = ReturnType<typeof useCaptcha>;

export function Turnstile({ captcha }: { captcha: Pick<CaptchaState, "enabled" | "setToken" | "resetKey"> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const { enabled, setToken, resetKey } = captcha;

  useEffect(() => {
    if (!enabled || !ref.current) return;
    let widgetId: string | undefined;
    let cancelled = false;
    setStatus("loading");
    loadScript()
      .then((api) => {
        if (cancelled || !ref.current) return;
        widgetId = api.render(ref.current, {
          sitekey: SITE_KEY,
          callback: (t: string) => {
            setToken(t);
            setStatus("ready");
          },
          "expired-callback": () => setToken(undefined),
          "error-callback": () => {
            setToken(undefined);
            setStatus("error");
          },
        });
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [enabled, setToken, resetKey, attempt]);

  if (!enabled) return null;
  return (
    <div role="group" aria-label="Human verification" className="flex flex-col gap-2">
      <div ref={ref} />
      <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
        {status === "loading" && "Checking that you are human…"}
        {status === "ready" && "Verification complete."}
      </p>
      {status === "error" && (
        <p className="text-sm text-destructive" role="alert">
          We could not load the human check.{" "}
          <button type="button" className="font-medium underline" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
        </p>
      )}
    </div>
  );
}

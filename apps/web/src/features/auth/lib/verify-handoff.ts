// The email being verified is handed from the register or sign-in screen to the code screen in
// sessionStorage, not in the URL: an address in a query string ends up in history, logs and
// referrers. Storage can be unavailable (private windows), so every access is guarded and the
// code screen simply asks for the address when nothing was passed.
const KEY = "pp.verify-email";

export function rememberEmailToVerify(email: string): void {
  try {
    sessionStorage.setItem(KEY, email);
  } catch {
    // not available: the code screen asks for the address
  }
}

export function recallEmailToVerify(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function forgetEmailToVerify(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Seconds named in the server's "Please wait N seconds…" message, or the fallback. */
export function secondsFromWaitMessage(message: string | undefined, fallback: number): number {
  const match = message?.match(/wait (\d+) seconds/i);
  return match ? Number(match[1]) : fallback;
}

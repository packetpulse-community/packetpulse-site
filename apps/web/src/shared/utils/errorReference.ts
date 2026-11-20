// Short code a person can quote to support (SCR-043). Derived from the Next.js
// error digest, which is a hash that matches the server log line, so support can
// find the failure without the user ever seeing the message or stack.
export function errorReference(digest?: string | null, fallback?: string): string {
  const source = (digest ?? "").replace(/[^a-zA-Z0-9]/g, "");
  if (source.length >= 4) return source.slice(0, 8).toUpperCase();
  return (fallback ?? "UNKNOWN").toUpperCase();
}

// Used when no digest exists (errors thrown in the browser): random but short.
export function randomReference(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { loginUrlFor } from "./safe-next";

// Must match PATH_HEADER in src/proxy.ts (not imported: proxy.ts is edge-only code).
const PATH_HEADER = "x-pp-path";

/**
 * Server-side: send a signed-out visitor to /login?next=<the page they asked for>,
 * so they return to it after signing in. The path is sanitised (same-site only).
 */
export async function redirectToLogin(): Promise<never> {
  const requested = (await headers()).get(PATH_HEADER);
  redirect(loginUrlFor(requested));
}

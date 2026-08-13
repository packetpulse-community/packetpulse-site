import { SetMetadata } from "@nestjs/common";

// Explicit per-route opt-out of the global auth guard chain — inverts the old app's
// fragile path-string allowlist (`publicPaths` array) into a decorator that's harder
// to forget/misconfigure (plan §4).
export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

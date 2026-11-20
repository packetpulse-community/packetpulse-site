"use client";

import { useMemo } from "react";
import { errorReference, randomReference } from "@/shared/utils/errorReference";
import "@/shared/styles/globals.css";
import "@/shared/styles/motion.css";

// Last-resort boundary: replaces the root layout, so it brings its own <html>,
// <body>, styles and dark theme, and uses only plain elements (no providers, no
// shell, no network). Never shows the message or stack, only a reference code.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const reference = useMemo(() => errorReference(error.digest, randomReference()), [error.digest]);

  return (
    <html lang="en" className="dark">
      <body>
        <main
          id="main"
          className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-5 px-4 text-center"
        >
          <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-muted-foreground">
            PacketPulse could not load. Nothing you entered has been lost. Try again in a moment.
          </p>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center justify-center rounded-md bg-indigo-600 px-4 text-sm font-medium text-white shadow-md hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Try again
          </button>
          <p className="text-xs text-muted-foreground">
            If this keeps happening, tell support this reference: <code className="font-mono text-foreground">{reference}</code>
          </p>
        </main>
      </body>
    </html>
  );
}

"use client";

import { useEffect, useMemo } from "react";
import { TriangleAlert } from "lucide-react";
import { logClientEvent } from "@/shared/utils/clientLogger";
import { errorReference, randomReference } from "@/shared/utils/errorReference";
import { StatusScreen } from "./StatusScreen";

// Body of every error.tsx. Shows "Something went wrong", Try again, and a short
// reference code. The error's message and stack are NEVER rendered (SCR-043);
// they go to the admin log pipeline instead, tagged with the same code.
export function ErrorBoundaryScreen({
  error,
  reset,
  mode,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  mode?: "page" | "embedded";
}) {
  const reference = useMemo(() => errorReference(error.digest, randomReference()), [error.digest]);

  useEffect(() => {
    logClientEvent({
      level: "error",
      context: "error-boundary",
      message: `Render error ${reference}`,
      data: { reference, digest: error.digest },
    });
  }, [error.digest, reference]);

  return (
    <StatusScreen
      mode={mode}
      icon={<TriangleAlert className="h-6 w-6" />}
      title="Something went wrong"
      action={{ label: "Try again", onClick: reset }}
      reference={reference}
      secondary={<a href="/dashboard" className="underline underline-offset-4 hover:text-foreground">Go to your dashboard</a>}
    >
      <p>We could not load this page. Nothing you entered has been lost. Try again in a moment.</p>
    </StatusScreen>
  );
}

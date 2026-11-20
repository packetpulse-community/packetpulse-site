"use client";

import { ErrorBoundaryScreen } from "@/shared/components/ErrorBoundaryScreen";

// Renders inside the shell (sidebar and top bar stay), so only the content area fails.
export default function SectionError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorBoundaryScreen error={error} reset={reset} mode="embedded" />;
}

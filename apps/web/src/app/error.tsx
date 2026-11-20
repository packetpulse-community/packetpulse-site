"use client";

import { ErrorBoundaryScreen } from "@/shared/components/ErrorBoundaryScreen";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorBoundaryScreen error={error} reset={reset} />;
}

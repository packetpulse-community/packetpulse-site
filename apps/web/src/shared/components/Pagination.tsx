"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/shared/ui/primitives/Button";

export function Pagination({ page, totalPages, basePath }: { page: number; totalPages: number; basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(next));
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div className="flex items-center justify-center gap-3">
      <Button variant="glass" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button variant="glass" size="sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
        Next
      </Button>
    </div>
  );
}

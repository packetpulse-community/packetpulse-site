"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";

export function AdminSearchBar({ basePath, placeholder = "Search…" }: { basePath: string; placeholder?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) params.set("search", debouncedSearch);
    else params.delete("search");
    params.delete("page");
    router.push(`${basePath}?${params.toString()}`);
  }, [debouncedSearch]);

  return (
    <div className="glass-panel flex flex-col gap-3 rounded-lg p-4">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={placeholder}
        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}

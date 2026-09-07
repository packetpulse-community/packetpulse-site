"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";

const LEVELS = ["debug", "info", "warn", "error"] as const;

export function LogsFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const debouncedSearch = useDebouncedValue(search, 300);
  const level = searchParams.get("level") ?? "";

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) params.set("search", debouncedSearch);
    else params.delete("search");
    params.delete("page");
    router.push(`/admin/logs?${params.toString()}`);
  }, [debouncedSearch]);

  function handleLevelChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("level", value);
    else params.delete("level");
    params.delete("page");
    router.push(`/admin/logs?${params.toString()}`);
  }

  return (
    <div className="glass-panel flex flex-col gap-3 rounded-lg p-4 sm:flex-row sm:items-center">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search message or context…"
        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <select
        value={level}
        onChange={(e) => handleLevelChange(e.target.value)}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">All levels</option>
        {LEVELS.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

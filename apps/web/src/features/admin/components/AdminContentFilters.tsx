"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";

const CATEGORIES = ["ccna", "ccnp", "network_automation", "security", "sdn", "ipv6", "general"] as const;

export function AdminContentFilters({
  basePath,
  typeOptions,
  typeParam = "resourceType",
}: {
  basePath: string;
  typeOptions?: readonly string[];
  typeParam?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const debouncedSearch = useDebouncedValue(search, 300);
  const category = searchParams.get("category") ?? "";
  const type = searchParams.get(typeParam) ?? "";
  const status = searchParams.get("status") ?? "";

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) params.set("search", debouncedSearch);
    else params.delete("search");
    params.delete("page");
    router.push(`${basePath}?${params.toString()}`);
  }, [debouncedSearch]);

  function handleChange(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div className="glass-panel flex flex-col gap-3 rounded-lg p-4 sm:flex-row sm:items-center">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search…"
        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      {typeOptions && (
        <select
          value={type}
          onChange={(e) => handleChange(typeParam, e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      )}
      <select
        value={category}
        onChange={(e) => handleChange("category", e.target.value)}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">All categories</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select
        value={status}
        onChange={(e) => handleChange("status", e.target.value)}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">All statuses</option>
        <option value="approved">Approved</option>
        <option value="pending">Pending</option>
      </select>
    </div>
  );
}

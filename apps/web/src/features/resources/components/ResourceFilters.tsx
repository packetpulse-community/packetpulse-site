"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";

const CATEGORIES = ["ccna", "ccnp", "network_automation", "security", "sdn", "ipv6", "general"] as const;
const RESOURCE_TYPES = [
  "pdf",
  "video",
  "article",
  "tutorial",
  "diagram",
  "config_template",
  "tool",
  "external_link",
] as const;

export function ResourceFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const debouncedSearch = useDebouncedValue(search, 300);
  const category = searchParams.get("category") ?? "";
  const resourceType = searchParams.get("resourceType") ?? "";

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) params.set("search", debouncedSearch);
    else params.delete("search");
    params.delete("page");
    router.push(`/resources?${params.toString()}`);
  }, [debouncedSearch]);

  function handleFilterChange(key: "category" | "resourceType", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`/resources?${params.toString()}`);
  }

  return (
    <div className="glass-panel flex flex-col gap-3 rounded-lg p-4 sm:flex-row sm:items-center">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search resources…"
        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <select
        value={resourceType}
        onChange={(e) => handleFilterChange("resourceType", e.target.value)}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">All types</option>
        {RESOURCE_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        value={category}
        onChange={(e) => handleFilterChange("category", e.target.value)}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">All categories</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { categoriesClientApi } from "@/features/categories/api/categories.api";

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
  const categoryId = searchParams.get("categoryId") ?? "";
  const resourceType = searchParams.get("resourceType") ?? "";
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: categoriesClientApi.list });

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) params.set("search", debouncedSearch);
    else params.delete("search");
    params.delete("page");
    router.push(`/resources?${params.toString()}`);
  }, [debouncedSearch]);

  function handleFilterChange(key: "categoryId" | "resourceType", value: string) {
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
        value={categoryId}
        onChange={(e) => handleFilterChange("categoryId", e.target.value)}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

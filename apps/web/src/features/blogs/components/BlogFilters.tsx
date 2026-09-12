"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { categoriesClientApi } from "@/features/categories/api/categories.api";
import { Badge } from "@/shared/ui/primitives/Badge";
import { cn } from "@/shared/utils/cn";

export function BlogFilters({ availableTags = [] }: { availableTags?: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const debouncedSearch = useDebouncedValue(search, 300);
  const categoryId = searchParams.get("categoryId") ?? "";
  const tag = searchParams.get("tag") ?? "";
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: categoriesClientApi.list });

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) params.set("search", debouncedSearch);
    else params.delete("search");
    params.delete("page");
    router.push(`/blogs?${params.toString()}`);
  }, [debouncedSearch]);

  function handleCategoryChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("categoryId", value);
    else params.delete("categoryId");
    params.delete("page");
    router.push(`/blogs?${params.toString()}`);
  }

  function handleTagClick(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tag === value) params.delete("tag");
    else params.set("tag", value);
    params.delete("page");
    router.push(`/blogs?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="glass-panel flex flex-col gap-3 rounded-lg p-4 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search posts…"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <select
          value={categoryId}
          onChange={(e) => handleCategoryChange(e.target.value)}
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

      {availableTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {availableTags.map((t) => (
            <button key={t} onClick={() => handleTagClick(t)} className={cn(tag === t && "opacity-100")}>
              <Badge variant={tag === t ? "default" : "glass"}>#{t}</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

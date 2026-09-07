"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { Badge } from "@/shared/ui/primitives/Badge";
import { cn } from "@/shared/utils/cn";

const CATEGORIES = ["ccna", "ccnp", "network_automation", "security", "sdn", "ipv6", "general"] as const;

export function BlogFilters({ availableTags = [] }: { availableTags?: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const debouncedSearch = useDebouncedValue(search, 300);
  const category = searchParams.get("category") ?? "";
  const tag = searchParams.get("tag") ?? "";

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) params.set("search", debouncedSearch);
    else params.delete("search");
    params.delete("page");
    router.push(`/blogs?${params.toString()}`);
  }, [debouncedSearch]);

  function handleCategoryChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("category", value);
    else params.delete("category");
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
          value={category}
          onChange={(e) => handleCategoryChange(e.target.value)}
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

"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/primitives/Button";
import type { AdminDateRangeQuery } from "../api/admin.api";

interface DashboardDateFilterProps {
  value: AdminDateRangeQuery;
  onApply: (range: AdminDateRangeQuery) => void;
}

export function DashboardDateFilter({ value, onApply }: DashboardDateFilterProps) {
  const [fromDate, setFromDate] = useState(value.fromDate ?? "");
  const [toDate, setToDate] = useState(value.toDate ?? "");

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">From Date</span>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">To Date</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        />
      </label>
      <Button onClick={() => onApply({ fromDate: fromDate || undefined, toDate: toDate || undefined })}>
        Apply Filter
      </Button>
    </div>
  );
}

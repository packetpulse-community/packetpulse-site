"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AdminActivityAction } from "@packetpulse/types";
import { DataTable, type DataTableColumn } from "@/shared/ui/primitives/DataTable";
import { adminClientApi, type AdminActivityLogEntry } from "../api/admin.api";

const ACTION_LABELS: Record<AdminActivityAction, string> = {
  user_approved: "Approved user",
  user_unapproved: "Unapproved user",
  user_roles_changed: "Changed roles",
  user_deleted: "Deleted user",
  resource_approved: "Approved resource",
  recording_approved: "Approved recording",
  blog_approved: "Approved blog post",
};

function describeDetails(entry: AdminActivityLogEntry): string {
  const details = entry.details ?? {};
  if (typeof details.title === "string") return details.title;
  if (typeof details.email === "string") return details.email;
  return entry.targetType;
}

// Real audit trail, backed by the new admin_activity_logs table — the old
// dashboard's "Recent Activity" table called a route (`/admin/activity`) that
// was never registered server-side and was permanently empty.
export function RecentActivityTable() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "activity", { page, limit: pageSize }],
    queryFn: () => adminClientApi.activity({ page, limit: pageSize }),
  });

  const columns: DataTableColumn<AdminActivityLogEntry>[] = [
    {
      field: "createdAt",
      header: "Time",
      render: (value) => new Date(value as string).toLocaleString(),
    },
    {
      field: "actor",
      header: "User",
      sortable: false,
      render: (_, row) => (row.actor ? `${row.actor.firstName} ${row.actor.lastName}` : "System"),
    },
    {
      field: "action",
      header: "Action",
      sortable: false,
      render: (value) => ACTION_LABELS[value as AdminActivityAction] ?? String(value),
    },
    {
      field: "details",
      header: "Details",
      sortable: false,
      render: (_, row) => <span className="text-muted-foreground">{describeDetails(row)}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data?.data ?? []}
      isLoading={isLoading}
      serverSide
      hideSearch
      totalItems={data?.total ?? 0}
      page={page}
      pageSize={pageSize}
      onPageChange={(nextPage, nextSize) => {
        setPage(nextPage);
        setPageSize(nextSize);
      }}
      rowKey={(row) => row.id}
    />
  );
}

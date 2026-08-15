"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable, type DataTableColumn } from "@/shared/ui/primitives/DataTable";
import { Badge } from "@/shared/ui/primitives/Badge";
import { adminClientApi, type AdminUser } from "../api/admin.api";

function formatDate(value?: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString();
}

// Read-only variant of AdminUsersTable for the dashboard's "Recent Users" card —
// no row actions, sorted newest-first. The old dashboard's equivalent table passed
// the wrong response shape into its DataTable and always rendered empty; this one
// is wired directly to the real paginated /admin/users endpoint.
export function RecentUsersTable() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");

  const filters = { page, limit: pageSize, search: search || undefined };
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", "recent", filters],
    queryFn: () => adminClientApi.listUsers(filters),
  });

  const columns: DataTableColumn<AdminUser>[] = [
    {
      field: "firstName",
      header: "User",
      render: (_, row) => (
        <div>
          <p className="font-medium">
            {row.firstName} {row.lastName}
          </p>
          <p className="text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    {
      field: "roles",
      header: "Role",
      sortable: false,
      render: (_, row) => <Badge variant="secondary">{row.roles[0] ?? "member"}</Badge>,
    },
    {
      field: "isApproved",
      header: "Status",
      render: (value) => (value ? <Badge variant="success">Approved</Badge> : <Badge variant="warning">Pending</Badge>),
    },
    { field: "createdAt", header: "Joined", render: (value) => formatDate(value as string) },
    { field: "lastLoginAt", header: "Last Login", render: (value) => formatDate(value as string | null) },
  ];

  return (
    <DataTable
      columns={columns}
      data={data?.data ?? []}
      isLoading={isLoading}
      serverSide
      totalItems={data?.total ?? 0}
      page={page}
      pageSize={pageSize}
      onPageChange={(nextPage, nextSize) => {
        setPage(nextPage);
        setPageSize(nextSize);
      }}
      onSearch={(term) => {
        setSearch(term);
        setPage(1);
      }}
      rowKey={(row) => row.id}
    />
  );
}

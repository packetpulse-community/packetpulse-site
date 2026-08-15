"use client";

import { DataTable, type DataTableColumn } from "@/shared/ui/primitives/DataTable";
import type { PendingResource } from "../api/admin.api";
import { ResourceApproveButton } from "./ResourceApproveButton";

const columns: DataTableColumn<PendingResource>[] = [
  { field: "title", header: "Title" },
  { field: "resourceType", header: "Type" },
  {
    field: "user",
    header: "Submitted by",
    sortable: false,
    render: (_, row) => `${row.user.firstName} ${row.user.lastName}`,
  },
  {
    field: "actions",
    header: "Actions",
    sortable: false,
    render: (_, row) => <ResourceApproveButton resourceId={row.id} />,
  },
];

export function PendingResourcesTable({ data }: { data: PendingResource[] }) {
  return <DataTable columns={columns} data={data} rowKey={(row) => row.id} />;
}

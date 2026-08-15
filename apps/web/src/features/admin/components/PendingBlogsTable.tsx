"use client";

import { DataTable, type DataTableColumn } from "@/shared/ui/primitives/DataTable";
import type { PendingBlog } from "../api/admin.api";
import { BlogApproveButton } from "./BlogApproveButton";

const columns: DataTableColumn<PendingBlog>[] = [
  { field: "title", header: "Title" },
  {
    field: "author",
    header: "Author",
    sortable: false,
    render: (_, row) => `${row.author.firstName} ${row.author.lastName}`,
  },
  {
    field: "actions",
    header: "Actions",
    sortable: false,
    render: (_, row) => <BlogApproveButton blogId={row.id} />,
  },
];

export function PendingBlogsTable({ data }: { data: PendingBlog[] }) {
  return <DataTable columns={columns} data={data} rowKey={(row) => row.id} />;
}

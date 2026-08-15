"use client";

import { DataTable, type DataTableColumn } from "@/shared/ui/primitives/DataTable";
import type { PendingRecording } from "../api/admin.api";
import { RecordingApproveButton } from "./RecordingApproveButton";

const columns: DataTableColumn<PendingRecording>[] = [
  { field: "title", header: "Title" },
  {
    field: "instructor",
    header: "Instructor",
    sortable: false,
    render: (_, row) => `${row.instructor.firstName} ${row.instructor.lastName}`,
  },
  {
    field: "actions",
    header: "Actions",
    sortable: false,
    render: (_, row) => <RecordingApproveButton recordingId={row.id} />,
  },
];

export function PendingRecordingsTable({ data }: { data: PendingRecording[] }) {
  return <DataTable columns={columns} data={data} rowKey={(row) => row.id} />;
}

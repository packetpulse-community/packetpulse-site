"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, Trash2, UserCheck, UserX } from "lucide-react";
import { useAuth } from "@/shared/auth/AuthProvider";
import { DataTable, type DataTableColumn } from "@/shared/ui/primitives/DataTable";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { adminClientApi, type AdminUser } from "../api/admin.api";
import { UserRoleDialog } from "./UserRoleDialog";
import { DeleteUserDialog } from "./DeleteUserDialog";

interface AdminUsersTableProps {
  initialApproved?: boolean;
}

export function AdminUsersTable({ initialApproved }: AdminUsersTableProps) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [approved] = useState(initialApproved);
  const [roleDialogUser, setRoleDialogUser] = useState<AdminUser | null>(null);
  const [deleteDialogUser, setDeleteDialogUser] = useState<AdminUser | null>(null);

  const filters = { page, limit: pageSize, search: search || undefined, approved };

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", filters],
    queryFn: () => adminClientApi.listUsers(filters),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => adminClientApi.approveUser(id),
    onSuccess: () => {
      toast.success("User approved");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to approve user"),
  });

  const unapproveMutation = useMutation({
    mutationFn: (id: string) => adminClientApi.unapproveUser(id),
    onSuccess: () => {
      toast.success("User unapproved");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to unapprove user"),
  });

  // super_admin bypasses granular permission checks server-side (no role_permissions
  // rows are seeded for it, see prisma/seed.ts) — mirror that here so the actions
  // column isn't hidden from super_admins just because their permissions array is empty.
  const isSuperAdmin = auth?.roles.includes("super_admin") ?? false;
  const canManageRoles = isSuperAdmin || (auth?.permissions.includes("users:manage-roles") ?? false);
  const canApprove = isSuperAdmin || (auth?.permissions.includes("users:approve") ?? false);

  const columns: DataTableColumn<AdminUser>[] = [
    {
      field: "firstName",
      header: "Name",
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
      field: "isApproved",
      header: "Status",
      render: (value) => (value ? <Badge variant="success">Approved</Badge> : <Badge variant="warning">Pending</Badge>),
    },
    {
      field: "roles",
      header: "Roles",
      sortable: false,
      render: (_, row) => (
        <div className="flex flex-wrap gap-1">
          {row.roles.map((role) => (
            <Badge key={role} variant="secondary">
              {role}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      field: "actions",
      header: "Actions",
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          {canApprove &&
            (row.isApproved ? (
              <Button
                variant="ghost"
                size="icon"
                title="Unapprove"
                disabled={unapproveMutation.isPending}
                onClick={() => unapproveMutation.mutate(row.id)}
              >
                <UserX className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                title="Approve"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate(row.id)}
              >
                <UserCheck className="h-4 w-4" />
              </Button>
            ))}
          {canManageRoles && (
            <Button variant="ghost" size="icon" title="Manage roles" onClick={() => setRoleDialogUser(row)}>
              <Shield className="h-4 w-4" />
            </Button>
          )}
          {canApprove && (
            <Button variant="ghost" size="icon" title="Delete" onClick={() => setDeleteDialogUser(row)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
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
      <UserRoleDialog user={roleDialogUser} onClose={() => setRoleDialogUser(null)} />
      <DeleteUserDialog user={deleteDialogUser} onClose={() => setDeleteDialogUser(null)} />
    </>
  );
}

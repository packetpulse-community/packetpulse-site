import { cookies } from "next/headers";
import { adminServerApi } from "@/features/admin/api/admin.api";
import { ApproveUserButton } from "@/features/admin/components/ApproveUserButton";

export default async function AdminUsersPage() {
  const cookieHeader = (await cookies()).toString();
  const pending = await adminServerApi.pendingUsers(cookieHeader);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Pending Approvals</h1>
      <div className="flex flex-col gap-2">
        {pending.map((user) => (
          <div key={user.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div>
              <p className="font-medium">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <ApproveUserButton userId={user.id} />
          </div>
        ))}
        {pending.length === 0 && <p className="text-muted-foreground">No pending approvals.</p>}
      </div>
    </div>
  );
}

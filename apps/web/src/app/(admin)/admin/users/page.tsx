import { AdminUsersTable } from "@/features/admin/components/AdminUsersTable";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ approved?: string }>;
}) {
  const { approved } = await searchParams;
  const initialApproved = approved === undefined ? undefined : approved === "true";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Users</h1>
      <AdminUsersTable initialApproved={initialApproved} />
    </div>
  );
}

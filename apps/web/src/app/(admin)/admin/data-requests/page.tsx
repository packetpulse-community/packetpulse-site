import { AdminDataRequests } from "@/features/data-rights/components/AdminDataRequests";

export const metadata = { title: "Data requests" };

export default function AdminDataRequestsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Data requests</h1>
        <p className="text-muted-foreground">
          Members&apos; export and deletion requests and what was recorded for each. This page is read-only: export files cannot be opened here.
        </p>
      </div>
      <AdminDataRequests />
    </div>
  );
}

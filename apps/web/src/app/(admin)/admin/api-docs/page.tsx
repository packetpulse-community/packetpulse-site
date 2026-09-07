import { ApiDocsExplorer } from "@/features/admin/components/ApiDocsExplorer";

export default function AdminApiDocsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">API Docs</h1>
        <p className="text-muted-foreground">Browse endpoints and send real requests against the live API.</p>
      </div>
      <ApiDocsExplorer />
    </div>
  );
}

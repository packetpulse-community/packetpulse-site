import { cookies } from "next/headers";
import { adminServerApi } from "@/features/admin/api/admin.api";
import { LogsFilters } from "@/features/admin/components/LogsFilters";
import { Pagination } from "@/shared/components/Pagination";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Card } from "@/shared/ui/primitives/Card";

const LEVEL_VARIANT = {
  error: "danger",
  warn: "warning",
  info: "default",
  debug: "outline",
} as const;

interface AdminLogsPageProps {
  searchParams: Promise<{ search?: string; level?: string; page?: string }>;
}

export default async function AdminLogsPage({ searchParams }: AdminLogsPageProps) {
  const params = await searchParams;
  const cookieHeader = (await cookies()).toString();

  const { data: logs, page, totalPages } = await adminServerApi.logs(cookieHeader, {
    search: params.search,
    level: params.level,
    page: params.page ? Number(params.page) : undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Logs Viewer</h1>
        <p className="text-muted-foreground">Client-side errors and events reported from the browser.</p>
      </div>

      <LogsFilters />

      <div className="flex flex-col gap-2">
        {logs.map((log) => (
          <Card key={log.id} variant="glass" className="flex flex-col gap-1 p-3">
            <div className="flex items-center gap-2">
              <Badge variant={LEVEL_VARIANT[log.level]}>{log.level}</Badge>
              {log.context && <span className="text-xs text-muted-foreground">{log.context}</span>}
              <span className="ml-auto text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-sm">{log.message}</p>
            {log.data ? <pre className="overflow-x-auto text-xs text-muted-foreground">{JSON.stringify(log.data)}</pre> : null}
          </Card>
        ))}
        {logs.length === 0 && <p className="text-muted-foreground">No logs recorded yet.</p>}
      </div>

      <Pagination page={page} totalPages={totalPages} basePath="/admin/logs" />
    </div>
  );
}

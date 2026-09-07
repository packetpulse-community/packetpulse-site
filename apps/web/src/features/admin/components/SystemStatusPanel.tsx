"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { adminClientApi, type SystemStatus } from "../api/admin.api";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/primitives/Card";
import { Button } from "@/shared/ui/primitives/Button";

function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function SystemStatusPanel({ initialStatus }: { initialStatus: SystemStatus }) {
  const { data, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ["admin", "system-status"],
    queryFn: adminClientApi.status,
    initialData: initialStatus,
    refetchInterval: 60_000,
  });

  const status = data ?? initialStatus;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Last updated: {new Date(dataUpdatedAt).toLocaleTimeString()}</p>
        <Button variant="glass" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              API Server
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
            <p>Uptime: {formatUptime(status.server.uptimeSeconds)}</p>
            <p>Environment: {status.server.nodeEnv}</p>
            <p>Node version: {status.server.nodeVersion}</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {status.database.status === "operational" ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
              Database
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
            <p>Status: {status.database.status}</p>
            <p>Query latency: {status.database.latencyMs}ms</p>
          </CardContent>
        </Card>

        <Card variant="glass" className="sm:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Memory Usage</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <p className="text-xl font-semibold">{status.memory.rssMb} MB</p>
              <p className="text-muted-foreground">RSS</p>
            </div>
            <div>
              <p className="text-xl font-semibold">{status.memory.heapUsedMb} MB</p>
              <p className="text-muted-foreground">Heap used</p>
            </div>
            <div>
              <p className="text-xl font-semibold">{status.memory.heapTotalMb} MB</p>
              <p className="text-muted-foreground">Heap total</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

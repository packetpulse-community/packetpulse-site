"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, RefreshCw } from "lucide-react";
import { adminClientApi, type SystemStatus, type ServiceState } from "../api/admin.api";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/primitives/Card";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";

function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

const STATE_UI: Record<ServiceState, { label: string; badge: "success" | "warning" | "danger" | "secondary"; Icon: typeof CheckCircle2; color: string }> = {
  operational: { label: "Operational", badge: "success", Icon: CheckCircle2, color: "text-green-500" },
  degraded: { label: "Slow", badge: "warning", Icon: AlertTriangle, color: "text-yellow-500" },
  down: { label: "Down", badge: "danger", Icon: XCircle, color: "text-red-500" },
  not_configured: { label: "Not configured", badge: "secondary", Icon: MinusCircle, color: "text-muted-foreground" },
};

function formatMs(ms: number | null) {
  return ms === null ? "—" : `${ms} ms`;
}

// The status request's own browser → backend round-trip, measured client-side —
// the one latency the backend can't measure about itself (includes Vercel's
// proxy hop and Render's network distance from the viewer).
async function fetchStatusTimed(): Promise<SystemStatus & { roundTripMs: number }> {
  const start = performance.now();
  const status = await adminClientApi.status();
  return { ...status, roundTripMs: Math.round(performance.now() - start) };
}

export function SystemStatusPanel({ initialStatus }: { initialStatus: SystemStatus }) {
  const { data, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ["admin", "system-status"],
    queryFn: fetchStatusTimed,
    initialData: { ...initialStatus, roundTripMs: -1 },
    refetchInterval: 60_000,
  });

  const status = data;
  const services = status.services ?? [];
  const endpoints = status.endpoints ?? [];
  const allOk =
    services.every((s) => s.status === "operational" || s.status === "not_configured") &&
    endpoints.every((e) => e.status === "operational");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {allOk ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <AlertTriangle className="h-5 w-5 text-yellow-500" />}
          <p className="font-medium">{allOk ? "All systems operational" : "Some systems need attention"}</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date(dataUpdatedAt).toLocaleTimeString()}
            {status.roundTripMs >= 0 && <> · Your browser → API: {status.roundTripMs} ms</>}
          </p>
          <Button variant="glass" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          const ui = STATE_UI[service.status];
          return (
            <Card key={service.key} variant="glass">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-2">
                    <ui.Icon className={`h-5 w-5 shrink-0 ${ui.color}`} />
                    {service.name}
                  </span>
                  <Badge variant={ui.badge}>{ui.label}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
                <p>Provider: {service.provider}</p>
                <p>
                  Response time: <span className="font-semibold text-foreground">{formatMs(service.latencyMs)}</span>
                </p>
                {service.detail && <p className="break-all text-xs">{service.detail}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card variant="glass">
        <CardHeader>
          <CardTitle className="text-base">API endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Endpoint</th>
                  <th className="py-2 pr-4 font-medium">Access</th>
                  <th className="py-2 pr-4 font-medium">HTTP</th>
                  <th className="py-2 pr-4 font-medium">Response time</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((endpoint) => {
                  const ui = STATE_UI[endpoint.status];
                  return (
                    <tr key={endpoint.path} className="border-t border-border/50">
                      <td className="py-2 pr-4 font-mono text-xs">
                        {endpoint.method} {endpoint.path}
                      </td>
                      <td className="py-2 pr-4 capitalize text-muted-foreground">{endpoint.auth}</td>
                      <td className="py-2 pr-4">{endpoint.httpStatus ?? "—"}</td>
                      <td className="py-2 pr-4">{formatMs(endpoint.latencyMs)}</td>
                      <td className="py-2">
                        <Badge variant={ui.badge}>{ui.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-base">API server process</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
            <p>Uptime: {formatUptime(status.server.uptimeSeconds)}</p>
            <p>Environment: {status.server.nodeEnv}</p>
            <p>Node version: {status.server.nodeVersion}</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-base">Memory usage</CardTitle>
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

"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { RunNetworkToolSchema, type RunNetworkToolDto } from "@packetpulse/types";
import { networkToolsClientApi, type NetworkToolResult } from "../api/network-tools.api";
import { ApiError } from "@/shared/api/http-client";
import { cn } from "@/shared/utils/cn";
import { Badge } from "@/shared/ui/primitives/Badge";
import { buttonVariants } from "@/shared/ui/primitives/Button";

const TOOL_OPTIONS = [
  { value: "ping", label: "Ping Test" },
  { value: "traceroute", label: "Trace Route" },
  { value: "dns", label: "DNS Lookup" },
  { value: "port-scan", label: "Port Scanner" },
] as const;

function ResultView({ result }: { result: NetworkToolResult }) {
  if (result.toolType === "ping") {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p>
          Avg latency: {result.avgLatencyMs}ms · Packet loss: {result.packetLossPct}%
        </p>
        <ul className="flex flex-col gap-1 font-mono text-xs text-muted-foreground">
          {result.replies.map((r) => (
            <li key={r.seq}>seq={r.seq} {r.lost ? "lost" : `time=${r.timeMs}ms`}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (result.toolType === "traceroute") {
    return (
      <ul className="flex flex-col gap-1 font-mono text-xs text-muted-foreground">
        {result.hops.map((h) => (
          <li key={h.hop}>
            {h.hop}. {h.address} — {h.latencyMs}ms
          </li>
        ))}
      </ul>
    );
  }
  if (result.toolType === "dns") {
    return (
      <ul className="flex flex-col gap-1 font-mono text-xs text-muted-foreground">
        {result.records.map((r, i) => (
          <li key={i}>
            {r.type} {r.value} (ttl {r.ttl})
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="flex flex-col gap-1 font-mono text-xs text-muted-foreground">
      {result.ports.map((p) => (
        <li key={p.port}>
          port {p.port}: {p.open ? "open" : "closed"}
        </li>
      ))}
    </ul>
  );
}

export function NetworkToolRunner() {
  const searchParams = useSearchParams();
  const initialTool = (searchParams.get("tool") ?? "ping") as RunNetworkToolDto["toolType"];
  const [result, setResult] = useState<NetworkToolResult | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RunNetworkToolDto>({ resolver: zodResolver(RunNetworkToolSchema), defaultValues: { toolType: initialTool } });

  const mutation = useMutation({
    mutationFn: networkToolsClientApi.run,
    onSuccess: setResult,
    onError: (err) => {
      const message = err instanceof ApiError ? ((err.body as { message?: string })?.message ?? "Could not run tool") : "Could not run tool";
      setError("root", { message });
    },
  });

  return (
    <div className="glass-panel flex flex-col gap-4 rounded-lg p-6">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Network Tools</h2>
        <Badge variant="glass">Simulated</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Results are deterministically simulated, not real network probes — running these tools from a shared server
        against arbitrary hosts is a security risk, so this is a safe sandbox instead.
      </p>

      <form onSubmit={handleSubmit((dto) => mutation.mutate(dto))} className="flex flex-col gap-3 sm:flex-row">
        <select {...register("toolType")} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          {TOOL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          {...register("target")}
          placeholder="Hostname or IP (e.g. 10.0.0.1)"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button type="submit" disabled={isSubmitting || mutation.isPending} className={cn(buttonVariants({ variant: "gradient" }))}>
          {mutation.isPending ? "Running…" : "Run"}
        </button>
      </form>
      {errors.target && <p className="text-sm text-destructive">{errors.target.message}</p>}
      {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

      {result && (
        <div className="glass-panel rounded-lg p-4">
          <ResultView result={result} />
        </div>
      )}
    </div>
  );
}

import { apiFetchClient } from "@/shared/api/http-client";
import type { RunNetworkToolDto } from "@packetpulse/types";

export interface PingResult {
  toolType: "ping";
  target: string;
  simulated: true;
  replies: { seq: number; lost: boolean; timeMs: number | null }[];
  packetLossPct: number;
  avgLatencyMs: number;
}

export interface TracerouteResult {
  toolType: "traceroute";
  target: string;
  simulated: true;
  hops: { hop: number; address: string; latencyMs: number }[];
}

export interface DnsResult {
  toolType: "dns";
  target: string;
  simulated: true;
  records: { type: string; value: string; ttl: number }[];
}

export interface PortScanResult {
  toolType: "port-scan";
  target: string;
  simulated: true;
  ports: { port: number; open: boolean }[];
}

export type NetworkToolResult = PingResult | TracerouteResult | DnsResult | PortScanResult;

export const networkToolsClientApi = {
  run: (dto: RunNetworkToolDto) =>
    apiFetchClient<NetworkToolResult>("/network-tools/run", { method: "POST", body: JSON.stringify(dto) }),
};

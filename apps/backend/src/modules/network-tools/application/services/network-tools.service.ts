import { Injectable } from "@nestjs/common";
import { RunNetworkToolDto } from "../dto/network-tools.dto";

// Explicitly NOT real network probing (plan §3/§9) — real ping/traceroute/port-scan
// from a shared server is a security/abuse risk (arbitrary hosts could be targeted
// for reconnaissance or DoS via this app). Output is deterministic per (toolType,
// target) pair via a seeded PRNG, not raw Math.random() on every call, so repeated
// runs against the same target return consistent results — "clean" mocked data
// rather than the old app's ad hoc random-number generators.
@Injectable()
export class NetworkToolsService {
  run(dto: RunNetworkToolDto) {
    const seed = this.hashSeed(`${dto.toolType}:${dto.target}`);
    const rng = this.mulberry32(seed);

    switch (dto.toolType) {
      case "ping":
        return this.simulatePing(dto.target, rng);
      case "traceroute":
        return this.simulateTraceroute(dto.target, rng);
      case "dns":
        return this.simulateDns(dto.target, rng);
      case "port-scan":
        return this.simulatePortScan(dto.target, rng);
    }
  }

  private simulatePing(target: string, rng: () => number) {
    const packetsSent = 4;
    const baseLatency = 10 + rng() * 40;
    const packetLossRate = rng() < 0.1 ? Math.floor(rng() * 25) : 0;
    const packetsLost = Math.round((packetLossRate / 100) * packetsSent);

    const replies = Array.from({ length: packetsSent }, (_, i) => {
      const lost = i < packetsLost;
      return {
        seq: i + 1,
        lost,
        timeMs: lost ? null : Math.round((baseLatency + rng() * 8) * 10) / 10,
      };
    });

    return {
      toolType: "ping" as const,
      target,
      simulated: true,
      replies,
      packetLossPct: packetLossRate,
      avgLatencyMs: Math.round(baseLatency * 10) / 10,
    };
  }

  private simulateTraceroute(target: string, rng: () => number) {
    const hopCount = 4 + Math.floor(rng() * 8);
    const hops = Array.from({ length: hopCount }, (_, i) => ({
      hop: i + 1,
      address: this.fakeIp(rng),
      latencyMs: Math.round((5 + i * 8 + rng() * 10) * 10) / 10,
    }));

    return { toolType: "traceroute" as const, target, simulated: true, hops };
  }

  private simulateDns(target: string, rng: () => number) {
    const recordCount = 1 + Math.floor(rng() * 3);
    const records = Array.from({ length: recordCount }, () => ({ type: "A", value: this.fakeIp(rng), ttl: 300 }));
    return { toolType: "dns" as const, target, simulated: true, records };
  }

  private simulatePortScan(target: string, rng: () => number) {
    const commonPorts = [22, 80, 443, 3306, 5432, 6379, 8080];
    const results = commonPorts.map((port) => ({ port, open: rng() < 0.3 }));
    return { toolType: "port-scan" as const, target, simulated: true, ports: results };
  }

  private fakeIp(rng: () => number): string {
    return [10, ...Array.from({ length: 3 }, () => Math.floor(rng() * 255))].join(".");
  }

  private hashSeed(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
    }
    return hash >>> 0;
  }

  private mulberry32(seed: number): () => number {
    let state = seed;
    return () => {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
}

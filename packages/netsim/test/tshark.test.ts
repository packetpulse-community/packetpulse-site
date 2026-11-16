import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SCENARIOS, runScenario, toPcap } from "../src";

// The independent oracle: Wireshark's own dissector reads what the simulator generated.
// If tshark is not installed the suite is skipped (CI installs it), never silently passed.
const hasTshark = spawnSync("tshark", ["--version"]).status === 0;

const FIELDS = [
  "frame.number",
  "_ws.col.Protocol",
  "_ws.col.Info",
  "_ws.malformed",
  "ip.checksum.status",
  "tcp.checksum.status",
  "udp.checksum.status",
  "icmp.checksum.status",
];

function tshark(file: string, extra: string[] = []): string[][] {
  const args = [
    "-r", file,
    "-o", "ip.check_checksum:TRUE",
    "-o", "tcp.check_checksum:TRUE",
    "-o", "udp.check_checksum:TRUE",
    "-T", "fields", "-E", "separator=|",
    ...FIELDS.flatMap((f) => ["-e", f]),
    ...extra,
  ];
  const out = execFileSync("tshark", args, { encoding: "utf8" });
  return out.split("\n").filter(Boolean).map((l) => l.split("|"));
}

describe.skipIf(!hasTshark)("tshark agrees with the simulator", () => {
  const CAPTURES: Record<string, string[]> = {
    "ping-lan": ["pc-a", "pc-b", "all"],
    "ping-router": ["pc-a", "web", "all"],
    "web-page": ["pc-a", "web", "dns", "all"],
  };
  for (const s of SCENARIOS) {
    for (const capture of CAPTURES[s.id] ?? ["all"]) {
      it(`${s.id} captured at ${capture}: no malformed packets and every checksum good`, () => {
        const dir = mkdtempSync(join(tmpdir(), "netsim-"));
        try {
          const file = join(dir, "t.pcap");
          writeFileSync(file, toPcap(runScenario(s.id), capture));
          const rows = tshark(file);
          expect(rows.length).toBeGreaterThan(3);
          for (const [n, , info, malformed, ip, tcp, udp, icmp] of rows) {
            expect(malformed, `frame ${n}: ${info}`).toBe("");
            // Wireshark's checksum status enumeration: 0 bad, 1 good, 2 unverified
            for (const status of [ip, tcp, udp, icmp]) if (status) expect(status, `frame ${n}: ${info}`).toBe("1");
          }
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      });
    }
  }

  it("web-page: tshark's protocol sequence and TCP expert analysis match the lab's story", () => {
    const dir = mkdtempSync(join(tmpdir(), "netsim-"));
    try {
      const file = join(dir, "t.pcap");
      writeFileSync(file, toPcap(runScenario("web-page"), "pc-a"));
      const rows = tshark(file);
      const proto = rows.map((r) => r[1]);
      expect(proto.slice(0, 3)).toEqual(["ARP", "ARP", "DNS"]);
      expect(proto).toContain("HTTP");
      const info = rows.map((r) => r[2] ?? "").join("\n");
      expect(info).toMatch(/Who has 192\.168\.1\.1\? Tell 192\.168\.1\.10/);
      expect(info).toMatch(/Standard query 0x[0-9a-f]+ A www\.lab\.example/);
      expect(info).toMatch(/\[SYN\] Seq=0 Win=64240 Len=0 MSS=1460/);
      expect(info).toMatch(/GET \/ HTTP\/1\.1/);
      expect(info).toMatch(/HTTP\/1\.1 200 OK/);
      // tshark's expert analysis must not flag retransmissions, resets or out-of-order data on a clean run
      const expert = execFileSync("tshark", ["-r", file, "-q", "-z", "expert"], { encoding: "utf8" });
      expect(expert).not.toMatch(/Errors \(|Warns \(|Retransmission|Out-Of-Order|Duplicate ACK|Malformed/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a lossy run is still valid, and tshark itself reports the retransmissions", () => {
    const dir = mkdtempSync(join(tmpdir(), "netsim-"));
    try {
      const file = join(dir, "t.pcap");
      writeFileSync(file, toPcap(runScenario("web-page", { lossPct: 20, seed: 5 }), "web"));
      const rows = tshark(file);
      for (const [n, , info, malformed, ip, tcp, udp] of rows) {
        expect(malformed, `frame ${n}: ${info}`).toBe("");
        for (const status of [ip, tcp, udp]) if (status) expect(status).toBe("1");
      }
      const expert = execFileSync("tshark", ["-r", file, "-q", "-z", "expert"], { encoding: "utf8" });
      expect(expert).toMatch(/retransmission/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

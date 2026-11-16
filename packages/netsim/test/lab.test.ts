import { describe, expect, it } from "vitest";
import { SCENARIOS, runScenario, dissectTrace, captureAt, buildTimeline, hex, type Trace } from "../src";

function rows(trace: Trace, device = "pc-a") {
  const d = dissectTrace(trace);
  return captureAt(trace, device).map((p) => ({ p, d: d.get(p.frame.id)! }));
}

describe("every scenario", () => {
  for (const s of SCENARIOS) {
    it(`${s.id}: all frames are valid, checksums verify, and the run is deterministic`, () => {
      const t1 = runScenario(s.id);
      const t2 = runScenario(s.id);
      expect(t1.frames.length).toBeGreaterThan(4);
      expect(t1.frames.map((f) => hex(f.bytes, ""))).toEqual(t2.frames.map((f) => hex(f.bytes, "")));
      const d = dissectTrace(t1);
      for (const f of t1.frames) expect(d.get(f.id)?.problems, `frame ${f.id}`).toEqual([]);
    });
  }
});

describe("ping-lan", () => {
  const t = runScenario("ping-lan");
  it("starts with a broadcast ARP request, answered by a unicast reply, before any ICMP", () => {
    const r = rows(t);
    expect(r[0]?.d.info).toBe("Who has 192.168.1.20? Tell 192.168.1.10");
    expect(r[0]?.d.dst).toBe("ff:ff:ff:ff:ff:ff");
    expect(r[1]?.d.info).toMatch(/^192\.168\.1\.20 is at 02:00:00:00:0b:01$/);
    expect(r[2]?.d.protocol).toBe("ICMP");
  });
  it("the switch floods the broadcast, then learns both MACs and stops flooding", () => {
    const sw = t.events.filter((e) => e.kind === "state" && e.device === "sw1" && e.table === "mac");
    expect(sw.map((e) => (e.kind === "state" ? e.key : ""))).toEqual(["02:00:00:00:0a:01", "02:00:00:00:0b:01"]);
    const floods = t.events.filter((e) => e.kind === "note" && e.device === "sw1" && /flood/.test(e.text));
    expect(floods).toHaveLength(1);
  });
  it("sends three echo requests and gets three replies", () => {
    const r = rows(t);
    expect(r.filter((x) => /Echo \(ping\) request/.test(x.d.info))).toHaveLength(3);
    expect(r.filter((x) => /Echo \(ping\) reply/.test(x.d.info))).toHaveLength(3);
  });
});

describe("ping-router", () => {
  const t = runScenario("ping-router");
  it("keeps the IP addresses but changes the MAC addresses at the router, and lowers the TTL", () => {
    const d = dissectTrace(t);
    const echoReq = t.frames.filter((f) => /Echo \(ping\) request/.test(d.get(f.id)!.info));
    // hop 1: PC-A to switch (TTL 64, destination MAC = router gi0/0); hop 3: router to switch (TTL 63, destination MAC = web)
    const first = d.get((echoReq[0] as { id: number }).id)!;
    const last = d.get((echoReq[echoReq.length - 1] as { id: number }).id)!;
    expect(first.dst).toBe("10.0.0.10");
    expect(first.layers[0]?.fields[0]?.value).toBe("02:00:00:00:f1:00");
    expect(last.layers[0]?.fields[0]?.value).toBe("02:00:00:00:c0:01");
    const ttl = (x: typeof first) => x.layers.find((l) => l.id === "ip")?.fields.find((f) => f.name === "Time to live")?.value;
    expect(ttl(first)).toBe("64");
    expect(ttl(last)).toBe("63");
  });
  it("the reply reaches PC-A with TTL 63", () => {
    const r = rows(t).filter((x) => /Echo \(ping\) reply/.test(x.d.info));
    expect(r.length).toBe(2);
    expect(r[0]?.d.info).toMatch(/ttl=63/);
  });
});

describe("web-page", () => {
  const t = runScenario("web-page");
  const r = rows(t);
  const infos = r.map((x) => `${x.d.protocol}: ${x.d.info}`);

  it("goes ARP, DNS, ARP, TCP handshake, HTTP, teardown in order", () => {
    const first = (re: RegExp) => infos.findIndex((i) => re.test(i));
    const order = [
      /ARP: Who has 192\.168\.1\.1\?/,
      /DNS: Standard query 0x[0-9a-f]+ A www\.lab\.example/,
      /DNS: Standard query response .* A 10\.0\.0\.10/,
      /\[SYN\] Seq=0/,
      /\[SYN, ACK\] Seq=0 Ack=1/,
      /HTTP: GET \/ HTTP\/1\.1/,
      /HTTP: HTTP\/1\.1 200 OK/,
      /\[FIN, ACK\]/,
    ].map(first);
    expect(order.every((i) => i >= 0), infos.join("\n")).toBe(true);
    expect([...order]).toEqual([...order].sort((a, b) => a - b));
  });

  it("splits the response into several segments no larger than the MSS", () => {
    const data = r.filter((x) => x.d.tcp && x.d.tcp.srcPort === 80 && x.d.tcp.payloadLength > 0);
    expect(data.length).toBeGreaterThanOrEqual(3);
    for (const x of data) expect(x.d.tcp!.payloadLength).toBeLessThanOrEqual(1460);
  });

  it("delivers exactly Content-Length bytes of body", () => {
    const resp = t.frames
      .map((f) => ({ f, d: dissectTrace(t).get(f.id)! }))
      .filter(({ d }) => d.tcp && d.tcp.srcPort === 80 && d.tcp.payloadLength > 0 && d.src === "10.0.0.10" && d.dst === "192.168.1.10");
    // each segment crosses 3 links; keep the first crossing (client side is the last hop, so just dedupe by sequence)
    const seen = new Map<number, number>();
    for (const { d } of resp) seen.set(d.tcp!.seq, d.tcp!.payloadLength);
    const total = [...seen.values()].reduce((a, b) => a + b, 0);
    const text = new TextDecoder().decode(
      Uint8Array.from(
        [...new Map(resp.map(({ f, d }) => [d.tcp!.seq, f] as const)).entries()]
          .sort((a, b) => a[0] - b[0])
          .flatMap(([, f]) => {
            const dd = dissectTrace(t).get(f.id)!;
            const tcp = dd.layers.find((l) => l.id === "tcp")!;
            return [...f.bytes.subarray(tcp.offset + tcp.length)];
          }),
      ),
    );
    const len = Number(/Content-Length: (\d+)/.exec(text)?.[1]);
    expect(text.split("\r\n\r\n")[1]?.length).toBe(len);
    expect(total).toBe(text.length);
  });

  it("closes cleanly: the client ends in CLOSED and no connection is left", () => {
    const tcpStates = t.events.filter((e) => e.kind === "state" && e.table === "tcp");
    const last = (dev: string) => [...tcpStates].reverse().find((e) => e.kind === "state" && e.device === dev && e.op === "set" && e.value !== "LISTEN");
    expect(last("pc-a") && last("pc-a")!.kind === "state" && (last("pc-a") as { value: string }).value).toBe("CLOSED");
    expect((last("web") as { value: string }).value).toBe("CLOSED");
    const states = tcpStates.map((e) => (e.kind === "state" ? e.value : ""));
    expect(states).toContain("TIME_WAIT");
    expect(states).toContain("FIN_WAIT_1");
    expect(states).toContain("CLOSE_WAIT");
    expect(states).toContain("LAST_ACK");
  });

  it("builds a timeline in which every frame starts after the frame that caused it arrives", () => {
    const tl = buildTimeline(t);
    for (const f of t.frames) {
      if (f.cause === undefined) continue;
      expect(tl.hops.get(f.id)!.start).toBeGreaterThanOrEqual(tl.hops.get(f.cause)!.end);
    }
  });
});

describe("loss and retransmission", () => {
  const t = runScenario("web-page", { lossPct: 20, seed: 5 });
  const d = dissectTrace(t);

  it("loses frames on the wire yet still completes the page load", () => {
    expect(t.frames.some((f) => f.dropped === "lost on the wire")).toBe(true);
    const notes = t.events.filter((e) => e.kind === "note").map((e) => (e.kind === "note" ? e.text : ""));
    expect(notes.some((n) => /Download complete: status 200/.test(n))).toBe(true);
  });

  it("retransmits the same TCP sequence number after a timeout", () => {
    const seen = new Set<string>();
    let repeats = 0;
    for (const f of t.frames) {
      const x = d.get(f.id)!;
      if (!x.tcp || x.tcp.payloadLength === 0) continue;
      const key = `${f.link}|${f.from.device}|${x.tcp.seq}`;
      if (seen.has(key)) repeats++;
      seen.add(key);
    }
    expect(repeats).toBeGreaterThan(0);
    const notes = t.events.filter((e) => e.kind === "note").map((e) => (e.kind === "note" ? e.text : ""));
    expect(notes.some((n) => /Retransmission timeout/.test(n))).toBe(true);
  });

  it("every frame, including the retransmissions, is still a valid packet", () => {
    for (const f of t.frames) expect(d.get(f.id)?.problems).toEqual([]);
  });
});

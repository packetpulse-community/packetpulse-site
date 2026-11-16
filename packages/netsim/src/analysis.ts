import { dissectFrame, type Dissection } from "./dissect";
import type { Frame, TraceEvent } from "./sim/core";
import type { Trace } from "./scenarios";

// ---- dissecting every frame with stream-relative TCP numbers --------------------------------

export type DissectedFrames = Map<number, Dissection>;

export function dissectTrace(trace: Trace): DissectedFrames {
  // Pass 1: find the initial sequence number each side of each TCP stream chose (the first
  // SYN it sent), so pass 2 can show the small relative numbers Wireshark shows by default.
  const isn = new Map<string, number>();
  for (const f of trace.frames) {
    const d = dissectFrame(f.bytes);
    if (d.tcp && d.tcp.flags & 0x02) {
      const key = `${d.src}:${d.tcp.srcPort}>${d.dst}:${d.tcp.dstPort}`;
      if (!isn.has(key)) isn.set(key, d.tcp.seq);
    }
  }
  const out: DissectedFrames = new Map();
  for (const f of trace.frames) {
    out.set(
      f.id,
      dissectFrame(f.bytes, {
        relativeTcp: (src, dst, t) => {
          const own = isn.get(`${src}:${t.srcPort}>${dst}:${t.dstPort}`);
          if (own === undefined) return undefined;
          const peer = isn.get(`${dst}:${t.dstPort}>${src}:${t.srcPort}`);
          return {
            seq: (t.seq - own) >>> 0,
            ack: t.flags & 0x10 && peer !== undefined ? (t.ack - peer) >>> 0 : t.ack,
          };
        },
      }),
    );
  }
  return out;
}

// ---- capture points -------------------------------------------------------------------------

export interface CapturedPacket {
  no: number;
  time: number; // microseconds of model time
  frame: Frame;
  direction: "tx" | "rx" | "hop";
}

// "Capturing at" a device is what Wireshark does on one network card: it sees the frames that
// card sent and received. "all" lists every frame on every link (a frame crossing three links
// appears three times), which is what the animation shows.
export function captureAt(trace: Trace, deviceId: string | "all"): CapturedPacket[] {
  const rows: Omit<CapturedPacket, "no">[] = [];
  for (const f of trace.frames) {
    if (deviceId === "all") rows.push({ time: f.txAt, frame: f, direction: "hop" });
    else {
      if (f.from.device === deviceId) rows.push({ time: f.txAt, frame: f, direction: "tx" });
      if (f.to.device === deviceId && !f.dropped) rows.push({ time: f.rxAt, frame: f, direction: "rx" });
    }
  }
  rows.sort((a, b) => a.time - b.time || a.frame.id - b.frame.id);
  return rows.map((r, i) => ({ ...r, no: i + 1 }));
}

// ---- display timeline --------------------------------------------------------------------------
//
// Model time is real network time (microseconds), which would make a LAN round trip last a
// blink. The timeline stretches it for teaching: every frame takes the same time to cross its
// link on screen, and a frame starts only once the frame that caused it has arrived, so cause and
// effect read in order. Idle gaps (such as waiting a second between pings) are squeezed.

export const HOP_MS = 800;
const GAP_MS = 120;
const STAGGER_MS = 220;
const IDLE_MS = 700;

export interface Timeline {
  hops: Map<number, { start: number; end: number }>;
  totalMs: number;
  // When each trace event should appear (display milliseconds), index-aligned with trace.events.
  eventTimes: number[];
}

export function buildTimeline(trace: Trace): Timeline {
  const hops = new Map<number, { start: number; end: number }>();
  const siblings = new Map<string, number>();
  let globalEnd = 0;

  const ordered = [...trace.frames].sort((a, b) => a.txAt - b.txAt || a.id - b.id);
  for (const f of ordered) {
    const parent = f.cause !== undefined ? hops.get(f.cause) : undefined;
    let start: number;
    if (parent) {
      const sibKey = `${f.cause}|${f.link}`;
      const n = siblings.get(sibKey) ?? 0;
      siblings.set(sibKey, n + 1);
      start = parent.end + GAP_MS + n * STAGGER_MS;
    } else {
      start = globalEnd === 0 ? 400 : globalEnd + IDLE_MS;
    }
    const end = start + HOP_MS;
    hops.set(f.id, { start, end });
    globalEnd = Math.max(globalEnd, end);
  }

  const startsByTxAt = ordered.map((f) => ({ t: f.txAt, start: (hops.get(f.id) as { start: number }).start }));
  const eventTimes = trace.events.map((e) => eventDisplayTime(e, hops, startsByTxAt, globalEnd));
  return { hops, totalMs: globalEnd + 600, eventTimes };
}

function eventDisplayTime(
  e: TraceEvent,
  hops: Map<number, { start: number; end: number }>,
  startsByTxAt: { t: number; start: number }[],
  globalEnd: number,
): number {
  if (e.frame !== undefined) {
    const h = hops.get(e.frame);
    if (h) return h.end;
  }
  // No causing frame (application or timer work): show it just before the first frame sent at
  // or after that moment, or at the very end when nothing follows.
  const next = startsByTxAt.find((s) => s.t >= e.t);
  return next ? Math.max(0, next.start - 1) : globalEnd;
}

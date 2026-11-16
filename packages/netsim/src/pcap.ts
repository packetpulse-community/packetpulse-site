import { ByteWriter, type Bytes } from "./bytes";
import { captureAt } from "./analysis";
import type { Trace } from "./scenarios";

// libpcap file (little-endian, microsecond timestamps, link type 1 = Ethernet). Opening the
// result in Wireshark or tcpdump is both a feature for learners and the independent check
// that every frame the simulator builds is a valid packet.

const EPOCH_BASE = 1_795_000_000; // fixed, so exports are reproducible

function le32(w: number[], v: number) {
  w.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
}

function le16(w: number[], v: number) {
  w.push(v & 0xff, (v >>> 8) & 0xff);
}

export function toPcap(trace: Trace, deviceId: string | "all"): Bytes {
  const out: number[] = [];
  le32(out, 0xa1b2c3d4); // magic number
  le16(out, 2); // version 2.4
  le16(out, 4);
  le32(out, 0); // time zone
  le32(out, 0); // timestamp accuracy
  le32(out, 65535); // snapshot length
  le32(out, 1); // link type: Ethernet

  for (const p of captureAt(trace, deviceId)) {
    const sec = EPOCH_BASE + Math.floor(p.time / 1_000_000);
    const usec = p.time % 1_000_000;
    le32(out, sec);
    le32(out, usec);
    le32(out, p.frame.bytes.length);
    le32(out, p.frame.bytes.length);
    for (const b of p.frame.bytes) out.push(b);
  }
  return Uint8Array.from(out);
}

export { ByteWriter };

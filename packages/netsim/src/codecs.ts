import {
  ByteWriter,
  ascii,
  bytesToIp,
  bytesToMac,
  concat,
  ipToBytes,
  macToBytes,
  setU16,
  u16,
  type Bytes,
} from "./bytes";
import { internetChecksum, l4Checksum } from "./checksum";

// ---- constants ---------------------------------------------------------------

export const ETHERTYPE_IPV4 = 0x0800;
export const ETHERTYPE_ARP = 0x0806;

export const IP_PROTO_ICMP = 1;
export const IP_PROTO_TCP = 6;
export const IP_PROTO_UDP = 17;

export const ICMP_ECHO_REPLY = 0;
export const ICMP_DEST_UNREACHABLE = 3;
export const ICMP_ECHO_REQUEST = 8;
export const ICMP_TIME_EXCEEDED = 11;

export const TCP_FIN = 0x01;
export const TCP_SYN = 0x02;
export const TCP_RST = 0x04;
export const TCP_PSH = 0x08;
export const TCP_ACK = 0x10;

export const ARP_REQUEST = 1;
export const ARP_REPLY = 2;

// ---- Ethernet II (IEEE 802.3 framing without the preamble and FCS, which capture
// tools do not normally see) ------------------------------------------------------

export interface EthernetFrame {
  dst: string;
  src: string;
  etherType: number;
  payload: ArrayLike<number>;
}

export function encodeEthernet(f: EthernetFrame): Bytes {
  return new ByteWriter().bytes(macToBytes(f.dst)).bytes(macToBytes(f.src)).u16(f.etherType).bytes(f.payload).toBytes();
}

export interface ParsedEthernet {
  dst: string;
  src: string;
  etherType: number;
  payload: Bytes;
}

export function parseEthernet(b: Bytes): ParsedEthernet | null {
  if (b.length < 14) return null;
  return { dst: bytesToMac(b, 0), src: bytesToMac(b, 6), etherType: u16(b, 12), payload: b.subarray(14) };
}

// ---- ARP (RFC 826) -----------------------------------------------------------

export interface ArpPacket {
  op: number;
  senderMac: string;
  senderIp: string;
  targetMac: string;
  targetIp: string;
}

export function encodeArp(a: ArpPacket): Bytes {
  return new ByteWriter()
    .u16(1) // hardware type: Ethernet
    .u16(ETHERTYPE_IPV4) // protocol type: IPv4
    .u8(6) // hardware address length
    .u8(4) // protocol address length
    .u16(a.op)
    .bytes(macToBytes(a.senderMac))
    .bytes(ipToBytes(a.senderIp))
    .bytes(macToBytes(a.targetMac))
    .bytes(ipToBytes(a.targetIp))
    .toBytes();
}

export function parseArp(b: Bytes): ArpPacket | null {
  if (b.length < 28 || u16(b, 0) !== 1 || u16(b, 2) !== ETHERTYPE_IPV4) return null;
  return {
    op: u16(b, 6),
    senderMac: bytesToMac(b, 8),
    senderIp: bytesToIp(b, 14),
    targetMac: bytesToMac(b, 18),
    targetIp: bytesToIp(b, 24),
  };
}

// ---- IPv4 (RFC 791) ----------------------------------------------------------

export interface Ipv4Packet {
  tos?: number;
  id: number;
  dontFragment?: boolean;
  moreFragments?: boolean;
  fragmentOffset?: number;
  ttl: number;
  protocol: number;
  src: string;
  dst: string;
  payload: ArrayLike<number>;
}

export const IPV4_HEADER_LENGTH = 20;

export function encodeIpv4(p: Ipv4Packet): Bytes {
  const total = IPV4_HEADER_LENGTH + p.payload.length;
  const flagsAndOffset =
    (p.dontFragment ? 0x4000 : 0) | (p.moreFragments ? 0x2000 : 0) | ((p.fragmentOffset ?? 0) & 0x1fff);
  const header = new ByteWriter()
    .u8(0x45) // version 4, header length 5 words (no options)
    .u8(p.tos ?? 0)
    .u16(total)
    .u16(p.id)
    .u16(flagsAndOffset)
    .u8(p.ttl)
    .u8(p.protocol)
    .u16(0) // checksum placeholder
    .bytes(ipToBytes(p.src))
    .bytes(ipToBytes(p.dst))
    .toBytes();
  setU16(header, 10, internetChecksum(header));
  return concat(header, p.payload);
}

// Routers change the TTL, so the header checksum must be recomputed at each hop.
export function rewriteIpv4Ttl(packet: Bytes, ttl: number): Bytes {
  const out = Uint8Array.from(packet);
  out[8] = ttl;
  setU16(out, 10, 0);
  setU16(out, 10, internetChecksum(out.subarray(0, IPV4_HEADER_LENGTH)));
  return out;
}

export interface ParsedIpv4 {
  version: number;
  headerLength: number;
  totalLength: number;
  id: number;
  dontFragment: boolean;
  ttl: number;
  protocol: number;
  src: string;
  dst: string;
  payload: Bytes;
  raw: Bytes;
}

// Minimal parse used by the simulator's own stack; the full field-by-field view for
// the interface lives in dissect.ts.
export function parseIpv4(b: Bytes): ParsedIpv4 | null {
  if (b.length < IPV4_HEADER_LENGTH) return null;
  const v = (b[0] ?? 0) >> 4;
  const ihl = ((b[0] ?? 0) & 0x0f) * 4;
  if (v !== 4 || ihl < IPV4_HEADER_LENGTH || b.length < ihl) return null;
  const total = u16(b, 2);
  const end = Math.min(total, b.length);
  return {
    version: v,
    headerLength: ihl,
    totalLength: total,
    id: u16(b, 4),
    dontFragment: (u16(b, 6) & 0x4000) !== 0,
    ttl: b[8] ?? 0,
    protocol: b[9] ?? 0,
    src: bytesToIp(b, 12),
    dst: bytesToIp(b, 16),
    payload: b.subarray(ihl, end),
    raw: b.subarray(0, end),
  };
}

// ---- ICMP (RFC 792) ----------------------------------------------------------

export function encodeIcmpEcho(type: number, id: number, seq: number, data: ArrayLike<number>): Bytes {
  const msg = new ByteWriter().u8(type).u8(0).u16(0).u16(id).u16(seq).bytes(data).toBytes();
  setU16(msg, 2, internetChecksum(msg));
  return msg;
}

// Error messages (destination unreachable, time exceeded) carry the offending IP header
// plus the first eight bytes of its payload so the sender can match the failure to a flow.
export function encodeIcmpError(type: number, code: number, offending: Bytes): Bytes {
  const quoted = offending.subarray(0, Math.min(offending.length, IPV4_HEADER_LENGTH + 8));
  const msg = new ByteWriter().u8(type).u8(code).u16(0).u32(0).bytes(quoted).toBytes();
  setU16(msg, 2, internetChecksum(msg));
  return msg;
}

// ---- UDP (RFC 768) -----------------------------------------------------------

export function encodeUdp(srcIp: string, dstIp: string, srcPort: number, dstPort: number, payload: ArrayLike<number>): Bytes {
  const length = 8 + payload.length;
  const seg = new ByteWriter().u16(srcPort).u16(dstPort).u16(length).u16(0).bytes(payload).toBytes();
  let sum = l4Checksum(srcIp, dstIp, IP_PROTO_UDP, seg);
  if (sum === 0) sum = 0xffff; // an all-zero result means "no checksum", so transmit all ones
  setU16(seg, 6, sum);
  return seg;
}

// ---- TCP (RFC 9293) ----------------------------------------------------------

export interface TcpSegment {
  srcPort: number;
  dstPort: number;
  seq: number;
  ack: number;
  flags: number;
  window: number;
  mss?: number; // sent as the MSS option on SYN segments
  payload?: ArrayLike<number>;
}

export function encodeTcp(srcIp: string, dstIp: string, s: TcpSegment): Bytes {
  const options = s.mss !== undefined ? new ByteWriter().u8(2).u8(4).u16(s.mss).toBytes() : new Uint8Array(0);
  const headerLength = 20 + options.length;
  const seg = new ByteWriter()
    .u16(s.srcPort)
    .u16(s.dstPort)
    .u32(s.seq)
    .u32(s.ack)
    .u8((headerLength / 4) << 4)
    .u8(s.flags)
    .u16(s.window)
    .u16(0) // checksum placeholder
    .u16(0) // urgent pointer
    .bytes(options)
    .bytes(s.payload ?? [])
    .toBytes();
  setU16(seg, 16, l4Checksum(srcIp, dstIp, IP_PROTO_TCP, seg));
  return seg;
}

export interface ParsedTcp {
  srcPort: number;
  dstPort: number;
  seq: number;
  ack: number;
  headerLength: number;
  flags: number;
  window: number;
  mss?: number;
  payload: Bytes;
}

export function parseTcp(b: Bytes): ParsedTcp | null {
  if (b.length < 20) return null;
  const headerLength = ((b[12] ?? 0) >> 4) * 4;
  if (headerLength < 20 || headerLength > b.length) return null;
  let mss: number | undefined;
  for (let i = 20; i < headerLength; ) {
    const kind = b[i] ?? 0;
    if (kind === 0) break;
    if (kind === 1) {
      i += 1;
      continue;
    }
    const len = b[i + 1] ?? 0;
    if (len < 2) break;
    if (kind === 2 && len === 4) mss = u16(b, i + 2);
    i += len;
  }
  return {
    srcPort: u16(b, 0),
    dstPort: u16(b, 2),
    seq: ((u16(b, 4) << 16) | u16(b, 6)) >>> 0,
    ack: ((u16(b, 8) << 16) | u16(b, 10)) >>> 0,
    headerLength,
    flags: b[13] ?? 0,
    window: u16(b, 14),
    mss,
    payload: b.subarray(headerLength),
  };
}

// ---- DNS (RFC 1035) ----------------------------------------------------------

export const DNS_TYPE_A = 1;
export const DNS_CLASS_IN = 1;

function encodeDnsName(name: string): number[] {
  const out: number[] = [];
  for (const label of name.split(".")) {
    if (label.length === 0 || label.length > 63) throw new Error(`Invalid DNS label in ${name}`);
    out.push(label.length, ...ascii(label));
  }
  out.push(0);
  return out;
}

export function encodeDnsQuery(id: number, name: string): Bytes {
  return new ByteWriter()
    .u16(id)
    .u16(0x0100) // standard query, recursion desired
    .u16(1) // one question
    .u16(0)
    .u16(0)
    .u16(0)
    .bytes(encodeDnsName(name))
    .u16(DNS_TYPE_A)
    .u16(DNS_CLASS_IN)
    .toBytes();
}

// The answer's name is a compression pointer (0xC00C) back to the question at offset 12.
export function encodeDnsResponse(id: number, name: string, ip: string | null, ttl: number): Bytes {
  const w = new ByteWriter()
    .u16(id)
    .u16(ip ? 0x8180 : 0x8183) // response, recursion desired and available; NOERROR or NXDOMAIN
    .u16(1)
    .u16(ip ? 1 : 0)
    .u16(0)
    .u16(0)
    .bytes(encodeDnsName(name))
    .u16(DNS_TYPE_A)
    .u16(DNS_CLASS_IN);
  if (ip) w.u16(0xc00c).u16(DNS_TYPE_A).u16(DNS_CLASS_IN).u32(ttl).u16(4).bytes(ipToBytes(ip));
  return w.toBytes();
}

export interface ParsedDns {
  id: number;
  isResponse: boolean;
  rcode: number;
  name: string;
  answers: string[]; // A record addresses
}

export function parseDns(b: Bytes): ParsedDns | null {
  if (b.length < 12) return null;
  const flags = u16(b, 2);
  const questions = u16(b, 4);
  const answerCount = u16(b, 6);
  let o = 12;
  let name = "";
  for (let q = 0; q < questions; q++) {
    const labels: string[] = [];
    while (o < b.length && (b[o] ?? 0) !== 0) {
      const len = b[o] ?? 0;
      labels.push(String.fromCharCode(...b.subarray(o + 1, o + 1 + len)));
      o += len + 1;
    }
    o += 1 + 4; // terminating zero, QTYPE, QCLASS
    if (q === 0) name = labels.join(".");
  }
  const answers: string[] = [];
  for (let a = 0; a < answerCount; a++) {
    if (((b[o] ?? 0) & 0xc0) === 0xc0) o += 2;
    else {
      while (o < b.length && (b[o] ?? 0) !== 0) o += (b[o] ?? 0) + 1;
      o += 1;
    }
    const type = u16(b, o);
    const rdlen = u16(b, o + 8);
    if (type === DNS_TYPE_A && rdlen === 4) answers.push(bytesToIp(b, o + 10));
    o += 10 + rdlen;
  }
  return { id: u16(b, 0), isResponse: (flags & 0x8000) !== 0, rcode: flags & 0x0f, name, answers };
}

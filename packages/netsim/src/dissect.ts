import {
  BROADCAST_MAC,
  bytesToIp,
  bytesToMac,
  concat,
  fromAscii,
  hex16,
  u16,
  u32,
  type Bytes,
} from "./bytes";
import { internetChecksum, l4Checksum } from "./checksum";
import {
  ARP_REPLY,
  ARP_REQUEST,
  ETHERTYPE_ARP,
  ETHERTYPE_IPV4,
  ICMP_DEST_UNREACHABLE,
  ICMP_ECHO_REPLY,
  ICMP_ECHO_REQUEST,
  ICMP_TIME_EXCEEDED,
  IP_PROTO_ICMP,
  IP_PROTO_TCP,
  IP_PROTO_UDP,
  TCP_ACK,
  TCP_FIN,
  TCP_PSH,
  TCP_RST,
  TCP_SYN,
} from "./codecs";

// ---- result types ---------------------------------------------------------------------

export interface Field {
  name: string;
  value: string;
  offset: number; // absolute byte offset inside the frame
  length: number;
  note?: string; // plain-language meaning
  status?: "ok" | "bad";
  children?: Field[];
}

export type LayerId = "eth" | "arp" | "ip" | "icmp" | "udp" | "tcp" | "dns" | "http" | "data";

export interface Layer {
  id: LayerId;
  name: string;
  osi: number; // OSI layer number this header belongs to
  tcpip: "link" | "internet" | "transport" | "application";
  offset: number;
  length: number;
  fields: Field[];
}

export interface TcpInfo {
  srcPort: number;
  dstPort: number;
  seq: number;
  ack: number;
  flags: number;
  payloadLength: number;
  window: number;
}

export interface Dissection {
  length: number;
  layers: Layer[];
  protocol: string; // highest protocol, as in a packet list's Protocol column
  src: string;
  dst: string;
  info: string;
  tcp?: TcpInfo;
  problems: string[];
}

export interface DissectOptions {
  // Maps raw TCP sequence and acknowledgement numbers to stream-relative ones, as
  // Wireshark does by default. Supplied by the trace analysis, which has seen the SYNs.
  relativeTcp?: (
    srcIp: string,
    dstIp: string,
    t: { srcPort: number; dstPort: number; seq: number; ack: number; flags: number },
  ) => { seq: number; ack: number } | undefined;
}

// ---- helpers --------------------------------------------------------------------------

const F = (name: string, value: string, offset: number, length: number, note?: string, extra: Partial<Field> = {}): Field => ({
  name,
  value,
  offset,
  length,
  note,
  ...extra,
});

function flagNames(flags: number): string {
  const names: [number, string][] = [
    [TCP_SYN, "SYN"],
    [TCP_FIN, "FIN"],
    [TCP_RST, "RST"],
    [TCP_PSH, "PSH"],
    [TCP_ACK, "ACK"],
  ];
  return names.filter(([bit]) => flags & bit).map(([, n]) => n).join(", ") || "none";
}

const ETHERTYPES: Record<number, string> = { [ETHERTYPE_IPV4]: "IPv4", [ETHERTYPE_ARP]: "ARP" };
const IP_PROTOCOLS: Record<number, string> = { [IP_PROTO_ICMP]: "ICMP", [IP_PROTO_TCP]: "TCP", [IP_PROTO_UDP]: "UDP" };

function macNote(mac: string): string {
  if (mac === BROADCAST_MAC) return "Broadcast: every device on the LAN receives it";
  const first = parseInt(mac.slice(0, 2), 16);
  return first & 1 ? "Multicast" : first & 2 ? "Unicast (locally administered address)" : "Unicast";
}

// ---- main entry -----------------------------------------------------------------------

export function dissectFrame(frame: Bytes, options: DissectOptions = {}): Dissection {
  const d: Dissection = { length: frame.length, layers: [], protocol: "Ethernet", src: "", dst: "", info: "", problems: [] };
  if (frame.length < 14) {
    d.problems.push("Frame shorter than an Ethernet header");
    return d;
  }

  const dstMac = bytesToMac(frame, 0);
  const srcMac = bytesToMac(frame, 6);
  const etherType = u16(frame, 12);
  d.src = srcMac;
  d.dst = dstMac;
  d.layers.push({
    id: "eth",
    name: "Ethernet II",
    osi: 2,
    tcpip: "link",
    offset: 0,
    length: 14,
    fields: [
      F("Destination", dstMac, 0, 6, macNote(dstMac)),
      F("Source", srcMac, 6, 6, macNote(srcMac)),
      F("Type", `${ETHERTYPES[etherType] ?? "Unknown"} (${hex16(etherType)})`, 12, 2, "Says which protocol is inside the frame"),
    ],
  });

  if (etherType === ETHERTYPE_ARP) dissectArp(frame, 14, d);
  else if (etherType === ETHERTYPE_IPV4) dissectIpv4(frame, 14, d, options);
  else d.info = `EtherType ${hex16(etherType)}`;
  return d;
}

// ---- ARP --------------------------------------------------------------------------------

function dissectArp(b: Bytes, o: number, d: Dissection) {
  if (b.length < o + 28) {
    d.problems.push("ARP packet truncated");
    return;
  }
  const op = u16(b, o + 6);
  const sha = bytesToMac(b, o + 8);
  const spa = bytesToIp(b, o + 14);
  const tha = bytesToMac(b, o + 18);
  const tpa = bytesToIp(b, o + 24);
  d.layers.push({
    id: "arp",
    name: "Address Resolution Protocol",
    osi: 2,
    tcpip: "link",
    offset: o,
    length: 28,
    fields: [
      F("Hardware type", "Ethernet (1)", o, 2),
      F("Protocol type", "IPv4 (0x0800)", o + 2, 2),
      F("Hardware size", "6", o + 4, 1, "Length of a MAC address"),
      F("Protocol size", "4", o + 5, 1, "Length of an IPv4 address"),
      F("Opcode", op === ARP_REQUEST ? "request (1)" : op === ARP_REPLY ? "reply (2)" : String(op), o + 6, 2),
      F("Sender MAC address", sha, o + 8, 6, "The asker's hardware address"),
      F("Sender IP address", spa, o + 14, 4),
      F("Target MAC address", tha, o + 18, 6, op === ARP_REQUEST ? "Unknown, so all zeros: that is the question" : "The asker's MAC"),
      F("Target IP address", tpa, o + 24, 4, op === ARP_REQUEST ? "The address whose MAC we want" : "The asker's IP"),
    ],
  });
  d.protocol = "ARP";
  d.info = op === ARP_REQUEST ? `Who has ${tpa}? Tell ${spa}` : `${spa} is at ${sha}`;
}

// ---- IPv4 -------------------------------------------------------------------------------

function dissectIpv4(b: Bytes, o: number, d: Dissection, options: DissectOptions) {
  if (b.length < o + 20) {
    d.problems.push("IPv4 header truncated");
    return;
  }
  const ihl = ((b[o] ?? 0) & 0x0f) * 4;
  const totalLength = u16(b, o + 2);
  const flagsOffset = u16(b, o + 6);
  const ttl = b[o + 8] ?? 0;
  const proto = b[o + 9] ?? 0;
  const checksum = u16(b, o + 10);
  const src = bytesToIp(b, o + 12);
  const dst = bytesToIp(b, o + 16);
  const header = b.subarray(o, o + ihl);
  const checksumOk = internetChecksum(header) === 0;
  const expected = (() => {
    const copy = Uint8Array.from(header);
    copy[10] = 0;
    copy[11] = 0;
    return internetChecksum(copy);
  })();
  if (!checksumOk) d.problems.push("IPv4 header checksum is incorrect");

  const df = (flagsOffset & 0x4000) !== 0;
  const mf = (flagsOffset & 0x2000) !== 0;
  d.layers.push({
    id: "ip",
    name: "Internet Protocol Version 4",
    osi: 3,
    tcpip: "internet",
    offset: o,
    length: ihl,
    fields: [
      F("Version", "4", o, 1, "IPv4"),
      F("Header length", `${ihl} bytes (${ihl / 4} words)`, o, 1, "20 bytes when there are no options"),
      F("Differentiated services", `0x${(b[o + 1] ?? 0).toString(16).padStart(2, "0")}`, o + 1, 1, "Traffic priority marking; 0 means default"),
      F("Total length", String(totalLength), o + 2, 2, "IP header plus everything inside it"),
      F("Identification", hex16(u16(b, o + 4)), o + 4, 2, "Groups the fragments of one packet"),
      F("Flags", `${df ? "Don't fragment" : "May fragment"}${mf ? ", more fragments" : ""}`, o + 6, 2, undefined, {
        children: [
          F("Don't fragment (DF)", df ? "set" : "not set", o + 6, 2, "If set, a router must not split this packet"),
          F("More fragments (MF)", mf ? "set" : "not set", o + 6, 2),
        ],
      }),
      F("Fragment offset", String(flagsOffset & 0x1fff), o + 6, 2),
      F("Time to live", String(ttl), o + 8, 1, "Each router subtracts 1; at 0 the packet is discarded. Stops routing loops"),
      F("Protocol", `${IP_PROTOCOLS[proto] ?? "Other"} (${proto})`, o + 9, 1, "Which protocol is inside"),
      F(
        "Header checksum",
        `${hex16(checksum)} [${checksumOk ? "correct" : `incorrect, should be ${hex16(expected)}`}]`,
        o + 10,
        2,
        "Covers the IP header only; routers recompute it because TTL changes",
        { status: checksumOk ? "ok" : "bad" },
      ),
      F("Source address", src, o + 12, 4),
      F("Destination address", dst, o + 16, 4),
    ],
  });
  d.protocol = IP_PROTOCOLS[proto] ?? "IPv4";
  d.src = src;
  d.dst = dst;
  d.info = `${src} → ${dst} (${IP_PROTOCOLS[proto] ?? proto})`;

  const end = Math.min(o + totalLength, b.length);
  const payloadOffset = o + ihl;
  if (proto === IP_PROTO_ICMP) dissectIcmp(b, payloadOffset, end, d, ttl);
  else if (proto === IP_PROTO_UDP) dissectUdp(b, payloadOffset, end, d, src, dst);
  else if (proto === IP_PROTO_TCP) dissectTcp(b, payloadOffset, end, d, src, dst, options);
}

// ---- ICMP -------------------------------------------------------------------------------

function dissectIcmp(b: Bytes, o: number, end: number, d: Dissection, ttl: number) {
  if (end - o < 8) return;
  const type = b[o] ?? 0;
  const code = b[o + 1] ?? 0;
  const msg = b.subarray(o, end);
  const ok = internetChecksum(msg) === 0;
  if (!ok) d.problems.push("ICMP checksum is incorrect");
  const expected = (() => {
    const copy = Uint8Array.from(msg);
    copy[2] = 0;
    copy[3] = 0;
    return internetChecksum(copy);
  })();
  const typeName: Record<number, string> = {
    [ICMP_ECHO_REPLY]: "Echo (ping) reply",
    [ICMP_ECHO_REQUEST]: "Echo (ping) request",
    [ICMP_DEST_UNREACHABLE]: "Destination unreachable",
    [ICMP_TIME_EXCEEDED]: "Time-to-live exceeded",
  };
  const fields: Field[] = [
    F("Type", `${typeName[type] ?? "Other"} (${type})`, o, 1),
    F("Code", String(code), o + 1, 1),
    F("Checksum", `${hex16(u16(b, o + 2))} [${ok ? "correct" : `incorrect, should be ${hex16(expected)}`}]`, o + 2, 2, "Covers the whole ICMP message", {
      status: ok ? "ok" : "bad",
    }),
  ];
  const isEcho = type === ICMP_ECHO_REQUEST || type === ICMP_ECHO_REPLY;
  if (isEcho) {
    const id = u16(b, o + 4);
    const seq = u16(b, o + 6);
    fields.push(
      F("Identifier", `${id} (${hex16(id)})`, o + 4, 2, "Lets the sender match replies to its own ping process"),
      F("Sequence number", `${seq}`, o + 6, 2, "Counts the pings so lost ones are visible"),
      F("Data", `${end - o - 8} bytes`, o + 8, end - o - 8, "Padding sent back unchanged in the reply"),
    );
    d.info = `${typeName[type]}  id=${hex16(id)}, seq=${seq}/${((seq & 0xff) << 8) | (seq >> 8)}, ttl=${ttl}`;
  } else {
    fields.push(F("Unused", "0", o + 4, 4));
    fields.push(F("Original packet header", "IP header and first 8 bytes of the packet that caused this error", o + 8, end - o - 8, "Lets the sender work out which of its packets failed"));
    d.info =
      type === ICMP_TIME_EXCEEDED
        ? "Time-to-live exceeded (Time to live exceeded in transit)"
        : type === ICMP_DEST_UNREACHABLE
          ? `Destination unreachable (${code === 3 ? "Port unreachable" : code === 0 ? "Network unreachable" : `code ${code}`})`
          : `ICMP type ${type}`;
  }
  d.layers.push({ id: "icmp", name: "Internet Control Message Protocol", osi: 3, tcpip: "internet", offset: o, length: end - o, fields });
  d.protocol = "ICMP";
}

// ---- UDP and DNS -----------------------------------------------------------------------

function dissectUdp(b: Bytes, o: number, end: number, d: Dissection, src: string, dst: string) {
  if (end - o < 8) return;
  const sport = u16(b, o);
  const dport = u16(b, o + 2);
  const length = u16(b, o + 4);
  const checksum = u16(b, o + 6);
  const seg = b.subarray(o, end);
  const ok = checksum === 0 || internetChecksum(concat([...src.split(".").map(Number), ...dst.split(".").map(Number), 0, IP_PROTO_UDP, (seg.length >> 8) & 255, seg.length & 255], seg)) === 0;
  const expected = (() => {
    const copy = Uint8Array.from(seg);
    copy[6] = 0;
    copy[7] = 0;
    const sum = l4Checksum(src, dst, IP_PROTO_UDP, copy);
    return sum === 0 ? 0xffff : sum;
  })();
  if (!ok) d.problems.push("UDP checksum is incorrect");
  d.layers.push({
    id: "udp",
    name: "User Datagram Protocol",
    osi: 4,
    tcpip: "transport",
    offset: o,
    length: 8,
    fields: [
      F("Source port", String(sport), o, 2, "Chosen by the sender; identifies the sending process"),
      F("Destination port", String(dport), o + 2, 2, dport === 53 || sport === 53 ? "53 is DNS" : undefined),
      F("Length", String(length), o + 4, 2, "UDP header plus data"),
      F("Checksum", `${hex16(checksum)} [${ok ? "correct" : `incorrect, should be ${hex16(expected)}`}]`, o + 6, 2, "Covers a pseudo-header (addresses), the UDP header and the data", {
        status: ok ? "ok" : "bad",
      }),
    ],
  });
  d.protocol = "UDP";
  d.info = `${sport} → ${dport} Len=${length - 8}`;
  if (sport === 53 || dport === 53) dissectDns(b, o + 8, end, d);
}

function readName(b: Bytes, o: number): { name: string; next: number } {
  const labels: string[] = [];
  let p = o;
  let next = -1;
  for (let guard = 0; guard < 64; guard++) {
    const len = b[p] ?? 0;
    if ((len & 0xc0) === 0xc0) {
      if (next < 0) next = p + 2;
      p = ((len & 0x3f) << 8) | (b[p + 1] ?? 0);
      continue;
    }
    if (len === 0) {
      if (next < 0) next = p + 1;
      break;
    }
    labels.push(fromAscii(b, p + 1, p + 1 + len));
    p += len + 1;
  }
  return { name: labels.join(".") || "<root>", next };
}

function dissectDns(b: Bytes, o: number, end: number, d: Dissection) {
  if (end - o < 12) return;
  const id = u16(b, o);
  const flags = u16(b, o + 2);
  const qd = u16(b, o + 4);
  const an = u16(b, o + 6);
  const isResponse = (flags & 0x8000) !== 0;
  const rcode = flags & 0x0f;
  const fields: Field[] = [
    F("Transaction ID", hex16(id), o, 2, "Matches a response to its query"),
    F("Flags", hex16(flags), o + 2, 2, isResponse ? "Standard query response" : "Standard query", {
      children: [
        F("Response", isResponse ? "this is a response" : "this is a query", o + 2, 2),
        F("Recursion desired", flags & 0x0100 ? "set" : "not set", o + 2, 2, "Asks the server to do the full lookup for us"),
        F("Recursion available", flags & 0x0080 ? "set" : "not set", o + 2, 2),
        F("Response code", rcode === 0 ? "No error (0)" : rcode === 3 ? "No such name (3)" : String(rcode), o + 2, 2),
      ],
    }),
    F("Questions", String(qd), o + 4, 2),
    F("Answer RRs", String(an), o + 6, 2),
    F("Authority RRs", String(u16(b, o + 8)), o + 8, 2),
    F("Additional RRs", String(u16(b, o + 10)), o + 10, 2),
  ];
  let p = o + 12;
  let qname = "";
  for (let i = 0; i < qd; i++) {
    const { name, next } = readName(b, p);
    qname = qname || name;
    fields.push(
      F("Query", `${name}, type A, class IN`, p, next - p + 4, "The question being asked", {
        children: [
          F("Name", name, p, next - p, "Written as length-prefixed labels, not dots"),
          F("Type", "A (1)", next, 2, "An IPv4 address record"),
          F("Class", "IN (1)", next + 2, 2, "Internet"),
        ],
      }),
    );
    p = next + 4;
  }
  let answerText = "";
  for (let i = 0; i < an; i++) {
    const { name, next } = readName(b, p);
    const type = u16(b, next);
    const ttl = u32(b, next + 4);
    const rdlen = u16(b, next + 8);
    const addr = type === 1 && rdlen === 4 ? bytesToIp(b, next + 10) : "";
    answerText = addr;
    fields.push(
      F("Answer", `${name}, type A, addr ${addr}`, p, next + 10 + rdlen - p, "The reply", {
        children: [
          F("Name", `${name} (compressed pointer)`, p, next - p, "0xC00C points back to the name in the question, saving space"),
          F("Type", "A (1)", next, 2),
          F("Class", "IN (1)", next + 2, 2),
          F("Time to live", `${ttl} s`, next + 4, 4, "How long the answer may be cached"),
          F("Data length", String(rdlen), next + 8, 2),
          F("Address", addr, next + 10, rdlen, "The IPv4 address for the name"),
        ],
      }),
    );
    p = next + 10 + rdlen;
  }
  d.layers.push({ id: "dns", name: "Domain Name System", osi: 7, tcpip: "application", offset: o, length: end - o, fields });
  d.protocol = "DNS";
  d.info = isResponse
    ? rcode === 3
      ? `Standard query response ${hex16(id)} No such name A ${qname}`
      : `Standard query response ${hex16(id)} A ${qname} A ${answerText}`
    : `Standard query ${hex16(id)} A ${qname}`;
}

// ---- TCP and HTTP ----------------------------------------------------------------------

function dissectTcp(b: Bytes, o: number, end: number, d: Dissection, src: string, dst: string, options: DissectOptions) {
  if (end - o < 20) return;
  const sport = u16(b, o);
  const dport = u16(b, o + 2);
  const seq = u32(b, o + 4);
  const ack = u32(b, o + 8);
  const hlen = ((b[o + 12] ?? 0) >> 4) * 4;
  const flags = b[o + 13] ?? 0;
  const window = u16(b, o + 14);
  const checksum = u16(b, o + 16);
  const seg = b.subarray(o, end);
  const copy = Uint8Array.from(seg);
  copy[16] = 0;
  copy[17] = 0;
  const expected = l4Checksum(src, dst, IP_PROTO_TCP, copy);
  const ok = expected === checksum;
  if (!ok) d.problems.push("TCP checksum is incorrect");
  const payloadLen = end - o - hlen;

  const rel = options.relativeTcp?.(src, dst, { srcPort: sport, dstPort: dport, seq, ack, flags });
  const showSeq = rel?.seq ?? seq;
  const showAck = rel?.ack ?? ack;

  const optionFields: Field[] = [];
  let mss: number | undefined;
  for (let i = o + 20; i < o + hlen; ) {
    const kind = b[i] ?? 0;
    if (kind === 0) break;
    if (kind === 1) {
      optionFields.push(F("No-operation (NOP)", "padding", i, 1));
      i += 1;
      continue;
    }
    const len = b[i + 1] ?? 0;
    if (len < 2) break;
    if (kind === 2) {
      mss = u16(b, i + 2);
      optionFields.push(F("Maximum segment size", `${mss} bytes`, i, len, "The largest chunk of data this side will accept in one segment"));
    } else optionFields.push(F(`Option kind ${kind}`, `${len} bytes`, i, len));
    i += len;
  }

  const fields: Field[] = [
    F("Source port", String(sport), o, 2),
    F("Destination port", String(dport), o + 2, 2, dport === 80 || sport === 80 ? "80 is HTTP" : undefined),
    F("Sequence number", rel ? `${showSeq} (relative), raw ${seq}` : String(seq), o + 4, 4, "Position, in bytes, of the first byte of data in this segment within the stream"),
    F(
      "Acknowledgment number",
      flags & TCP_ACK ? (rel ? `${showAck} (relative), raw ${ack}` : String(ack)) : "0 (not used)",
      o + 8,
      4,
      "The next byte the sender of this segment expects to receive. Everything before it has arrived",
    ),
    F("Header length", `${hlen} bytes`, o + 12, 1, "20 bytes plus any options"),
    F("Flags", `${hex16(flags)} (${flagNames(flags)})`, o + 13, 1, "Control bits that drive the connection state machine", {
      children: [
        F("SYN", flags & TCP_SYN ? "set" : "not set", o + 13, 1, "Synchronise sequence numbers: opens a connection"),
        F("ACK", flags & TCP_ACK ? "set" : "not set", o + 13, 1, "The acknowledgment number is valid"),
        F("PSH", flags & TCP_PSH ? "set" : "not set", o + 13, 1, "Hand the data to the application now"),
        F("FIN", flags & TCP_FIN ? "set" : "not set", o + 13, 1, "This side has finished sending"),
        F("RST", flags & TCP_RST ? "set" : "not set", o + 13, 1, "Abort the connection"),
      ],
    }),
    F("Window", String(window), o + 14, 2, "How many more bytes the sender of this segment can accept (flow control)"),
    F("Checksum", `${hex16(checksum)} [${ok ? "correct" : `incorrect, should be ${hex16(expected)}`}]`, o + 16, 2, "Covers a pseudo-header (addresses), the TCP header and the data", {
      status: ok ? "ok" : "bad",
    }),
    F("Urgent pointer", String(u16(b, o + 18)), o + 18, 2, "Unused unless the URG flag is set"),
  ];
  if (optionFields.length > 0) fields.push(F("Options", `${hlen - 20} bytes`, o + 20, hlen - 20, undefined, { children: optionFields }));
  if (payloadLen > 0) fields.push(F("TCP payload", `${payloadLen} bytes`, o + hlen, payloadLen, "Data handed to the application above"));

  d.layers.push({ id: "tcp", name: "Transmission Control Protocol", osi: 4, tcpip: "transport", offset: o, length: hlen, fields });
  d.protocol = "TCP";
  d.tcp = { srcPort: sport, dstPort: dport, seq, ack, flags, payloadLength: payloadLen, window };

  let info = `${sport} → ${dport} [${flagNames(flags).replace(/, /g, ", ")}] Seq=${showSeq}${flags & TCP_ACK ? ` Ack=${showAck}` : ""} Win=${window} Len=${payloadLen}`;
  if (mss !== undefined) info += ` MSS=${mss}`;
  d.info = info;

  if (payloadLen > 0 && (sport === 80 || dport === 80)) dissectHttp(b, o + hlen, end, d);
}

function dissectHttp(b: Bytes, o: number, end: number, d: Dissection) {
  const text = fromAscii(b, o, end);
  const isStart = /^(GET|POST|PUT|HEAD|DELETE|HTTP\/1\.[01]) /.test(text);
  if (!isStart) {
    d.layers.push({
      id: "data",
      name: "Continuation of the HTTP message",
      osi: 7,
      tcpip: "application",
      offset: o,
      length: end - o,
      fields: [F("Data", `${end - o} bytes`, o, end - o, "More of the message that began in an earlier segment. TCP delivers the bytes in order; HTTP reads them as one stream")],
    });
    d.info += " [TCP segment of a reassembled PDU]";
    return;
  }
  const fields: Field[] = [];
  let p = o;
  const headerEnd = text.indexOf("\r\n\r\n");
  const headerBlock = headerEnd >= 0 ? text.slice(0, headerEnd) : text;
  const lines = headerBlock.split("\r\n");
  lines.forEach((line, i) => {
    const len = line.length + 2;
    fields.push(F(i === 0 ? "Start line" : "Header", line, p, Math.min(len, end - p), i === 0 ? "Request line or status line" : undefined));
    p += len;
  });
  if (headerEnd >= 0) {
    fields.push(F("Blank line", "end of headers", o + headerEnd, 4, "A blank line separates the headers from the body"));
    const bodyStart = o + headerEnd + 4;
    if (bodyStart < end) fields.push(F("Message body", `${end - bodyStart} bytes (starts in this segment)`, bodyStart, end - bodyStart, "The page itself"));
  }
  d.layers.push({ id: "http", name: "Hypertext Transfer Protocol", osi: 7, tcpip: "application", offset: o, length: end - o, fields });
  d.protocol = "HTTP";
  const first = lines[0] ?? "";
  d.info = first.startsWith("HTTP/") ? `${first}${/Content-Type: ([^\r]+)/.exec(headerBlock) ? `  (${/Content-Type: ([^;\r]+)/.exec(headerBlock)?.[1]})` : ""}` : first;
}


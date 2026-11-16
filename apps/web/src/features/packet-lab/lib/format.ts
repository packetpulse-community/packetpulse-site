import type { Dissection } from "@packetpulse/netsim";

// Protocol colours. Colour is never the only signal: every chip also shows the protocol's name.
export const PROTOCOL_COLOR: Record<string, string> = {
  ARP: "#f59e0b",
  ICMP: "#38bdf8",
  UDP: "#94a3b8",
  DNS: "#a78bfa",
  TCP: "#2dd4bf",
  HTTP: "#4ade80",
  Ethernet: "#cbd5e1",
};

export function protocolColor(protocol: string): string {
  return PROTOCOL_COLOR[protocol] ?? "#cbd5e1";
}

// A very short label for a packet travelling on the topology diagram.
export function packetBadge(d: Dissection): string {
  const info = d.info;
  if (d.protocol === "ARP") return info.startsWith("Who has") ? "ARP?" : "ARP!";
  if (d.protocol === "ICMP") {
    if (/request/.test(info)) return "ping";
    if (/reply/.test(info)) return "pong";
    if (/Time-to-live/.test(info)) return "TTL!";
    return "ICMP";
  }
  if (d.protocol === "DNS") return /response/.test(info) ? "DNS!" : "DNS?";
  if (d.protocol === "HTTP") return info.startsWith("GET") ? "GET" : /^HTTP\/1\.\d (\d+)/.exec(info)?.[1] ?? "HTTP";
  if (d.tcp) {
    const f = d.tcp.flags;
    if (f & 0x04) return "RST";
    if (f & 0x02) return f & 0x10 ? "SYN-ACK" : "SYN";
    if (f & 0x01) return "FIN";
    return d.tcp.payloadLength > 0 ? "data" : "ACK";
  }
  return d.protocol;
}

export function formatSeconds(us: number): string {
  return (us / 1_000_000).toFixed(6);
}

export function formatMs(us: number): string {
  return `${(us / 1000).toFixed(3)} ms`;
}

export const OSI_LAYERS = [
  { n: 7, name: "Application", pdu: "Data", examples: "HTTP, DNS" },
  { n: 6, name: "Presentation", pdu: "Data", examples: "Encoding, TLS encryption" },
  { n: 5, name: "Session", pdu: "Data", examples: "Sessions, dialogue control" },
  { n: 4, name: "Transport", pdu: "Segment (TCP) / Datagram (UDP)", examples: "TCP, UDP" },
  { n: 3, name: "Network", pdu: "Packet", examples: "IP, ICMP" },
  { n: 2, name: "Data link", pdu: "Frame", examples: "Ethernet, ARP" },
  { n: 1, name: "Physical", pdu: "Bits", examples: "Cables, signals" },
] as const;

export const TCPIP_LAYERS = [
  { name: "Application", osi: [7, 6, 5], key: "application" },
  { name: "Transport", osi: [4], key: "transport" },
  { name: "Internet", osi: [3], key: "internet" },
  { name: "Network access", osi: [2, 1], key: "link" },
] as const;

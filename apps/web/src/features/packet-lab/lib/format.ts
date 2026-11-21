import type { Dissection } from "@packetpulse/netsim";

// Protocol colours come from CSS variables (styles/packet-lab.css), so they follow Light and Dark.
// Colour is never the only signal: every chip, badge and legend entry also shows the protocol's name.
export type ProtocolKey = "eth" | "arp" | "ip" | "icmp" | "udp" | "tcp" | "dns" | "http";

const PROTOCOL_KEY: Record<string, ProtocolKey> = {
  ARP: "arp",
  ICMP: "icmp",
  UDP: "udp",
  DNS: "dns",
  TCP: "tcp",
  HTTP: "http",
  Ethernet: "eth",
  IP: "ip",
};

// Layer ids from the dissector: the same hues, and a bare "data" continuation uses the HTTP hue.
const LAYER_KEY: Record<string, ProtocolKey> = { eth: "eth", arp: "arp", ip: "ip", icmp: "icmp", udp: "udp", tcp: "tcp", dns: "dns", http: "http", data: "http" };

export function protocolKey(protocol: string): ProtocolKey {
  return PROTOCOL_KEY[protocol] ?? "eth";
}

export function layerKey(layerId: string): ProtocolKey {
  return LAYER_KEY[layerId] ?? "eth";
}

export const protocolColor = (protocol: string) => `var(--pl-${protocolKey(protocol)})`;
export const protocolSoft = (protocol: string) => `var(--pl-${protocolKey(protocol)}-soft)`;
export const layerColor = (layerId: string) => `var(--pl-${layerKey(layerId)})`;
export const layerSoft = (layerId: string) => `var(--pl-${layerKey(layerId)}-soft)`;

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

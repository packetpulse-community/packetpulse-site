import {
  BROADCAST_MAC,
  bytesToMac,
  intToIp,
  ipToInt,
  maskToDotted,
  networkOf,
  prefixToMask,
  sameSubnet,
  u16,
  type Bytes,
} from "../bytes";
import { internetChecksum, l4ChecksumValid } from "../checksum";
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
  encodeArp,
  encodeEthernet,
  encodeIcmpEcho,
  encodeIcmpError,
  encodeIpv4,
  encodeUdp,
  parseArp,
  parseEthernet,
  parseIpv4,
  parseTcp,
  rewriteIpv4Ttl,
  type ParsedIpv4,
} from "../codecs";
import { Device, type DeviceKind, type Iface, type Network } from "./core";
import { TcpStack } from "./tcp";

const ARP_RETRY_US = 1_000_000;
const ARP_MAX_ATTEMPTS = 3;

interface PendingArp {
  iface: Iface;
  queue: Bytes[];
  attempts: number;
}

// Shared by hosts and routers: an ARP cache, the queue of packets waiting for an
// address to be resolved, and Ethernet framing.
export abstract class IpNode extends Device {
  readonly arp = new Map<string, string>();
  private readonly pending = new Map<string, PendingArp>();
  private ipId: number;

  constructor(id: string, name: string, kind: DeviceKind, net: Network) {
    super(id, name, kind, net);
    this.ipId = net.rng.int(0xffff);
  }

  protected nextIpId(): number {
    this.ipId = (this.ipId + 1) & 0xffff;
    return this.ipId;
  }

  protected sendEth(iface: Iface, dstMac: string, etherType: number, payload: Bytes): number | undefined {
    return this.net.transmit(iface, encodeEthernet({ dst: dstMac, src: iface.mac, etherType, payload }));
  }

  // Layer 3 to layer 2 hand-off: find the next hop's MAC address (ARP if needed) and frame the packet.
  protected resolveAndSend(iface: Iface, nextHopIp: string, ipPacket: Bytes) {
    const mac = this.arp.get(nextHopIp);
    if (mac) {
      this.sendEth(iface, mac, ETHERTYPE_IPV4, ipPacket);
      return;
    }
    const waiting = this.pending.get(nextHopIp);
    if (waiting) {
      waiting.queue.push(ipPacket);
      return;
    }
    this.note(
      2,
      `I do not know the MAC address of ${nextHopIp} yet. The packet waits while I ask the whole LAN "who has ${nextHopIp}?" with an ARP broadcast.`,
    );
    const entry: PendingArp = { iface, queue: [ipPacket], attempts: 0 };
    this.pending.set(nextHopIp, entry);
    this.sendArpRequest(nextHopIp, entry);
  }

  private sendArpRequest(targetIp: string, entry: PendingArp) {
    entry.attempts++;
    const iface = entry.iface;
    if (!iface.ip) return;
    const arp = encodeArp({
      op: ARP_REQUEST,
      senderMac: iface.mac,
      senderIp: iface.ip,
      targetMac: "00:00:00:00:00:00",
      targetIp,
    });
    this.sendEth(iface, BROADCAST_MAC, ETHERTYPE_ARP, arp);
    this.net.later(ARP_RETRY_US, () => {
      if (this.pending.get(targetIp) !== entry) return;
      if (entry.attempts < ARP_MAX_ATTEMPTS) {
        this.note(2, `No ARP reply for ${targetIp} after 1 s. Asking again (attempt ${entry.attempts + 1} of ${ARP_MAX_ATTEMPTS}).`);
        this.sendArpRequest(targetIp, entry);
      } else {
        this.pending.delete(targetIp);
        this.note(2, `ARP gave up on ${targetIp}: nobody answered. The queued packet is dropped (host unreachable).`);
      }
    });
  }

  protected learn(ip: string, mac: string) {
    if (this.arp.get(ip) === mac) return;
    this.arp.set(ip, mac);
    this.state("arp", "set", ip, mac);
    this.note(2, `ARP cache updated: ${ip} is at ${mac}.`);
  }

  protected handleArp(iface: Iface, payload: Bytes) {
    const a = parseArp(payload);
    if (!a || !iface.ip) return;
    if (a.targetIp !== iface.ip) {
      this.note(2, `ARP ${a.op === ARP_REQUEST ? "request" : "reply"} is about ${a.targetIp}, not ${iface.ip}. Ignored.`);
      return;
    }
    this.learn(a.senderIp, a.senderMac);
    if (a.op === ARP_REQUEST) {
      this.note(2, `That ARP request is asking for me (${iface.ip}). I answer directly to ${a.senderMac}, not by broadcast.`);
      const reply = encodeArp({
        op: ARP_REPLY,
        senderMac: iface.mac,
        senderIp: iface.ip,
        targetMac: a.senderMac,
        targetIp: a.senderIp,
      });
      this.sendEth(iface, a.senderMac, ETHERTYPE_ARP, reply);
    }
    const waiting = this.pending.get(a.senderIp);
    if (waiting) {
      this.pending.delete(a.senderIp);
      for (const packet of waiting.queue) this.sendEth(waiting.iface, a.senderMac, ETHERTYPE_IPV4, packet);
    }
  }

  // The IPv4 header checksum is verified on receipt, as real stacks do.
  protected validIpHeader(ip: ParsedIpv4): boolean {
    return internetChecksum(ip.raw.subarray(0, ip.headerLength)) === 0;
  }
}

// ---- host -----------------------------------------------------------------------------

export interface IcmpEchoReply {
  from: string;
  seq: number;
  ttl: number;
  bytes: number;
}

export class Host extends IpNode {
  gateway?: string;
  dnsServer?: string;
  readonly dnsCache = new Map<string, string>();
  readonly udp = new Map<number, (srcIp: string, srcPort: number, payload: Bytes) => void>();
  readonly pingListeners = new Map<number, (r: IcmpEchoReply) => void>();
  readonly tcp: TcpStack;
  private readonly routeNoted = new Set<string>();

  constructor(id: string, name: string, net: Network) {
    super(id, name, "host", net);
    this.tcp = new TcpStack(this);
  }

  get iface(): Iface {
    return this.ifaces[0] as Iface;
  }

  get ip(): string {
    return this.iface.ip as string;
  }

  get network() {
    return this.net;
  }

  newEphemeralPort(): number {
    return 49152 + this.net.rng.int(16384);
  }

  sendIp(dst: string, protocol: number, payload: Bytes, opts: { ttl?: number; dontFragment?: boolean } = {}): boolean {
    const iface = this.iface;
    if (!iface.ip || iface.prefix === undefined) return false;
    const onLink = sameSubnet(dst, iface.ip, iface.prefix);
    const nextHop = onLink ? dst : this.gateway;
    if (!nextHop) {
      this.note(3, `${dst} is not on my subnet and I have no default gateway, so there is nowhere to send it.`);
      return false;
    }
    if (!this.routeNoted.has(dst)) {
      this.routeNoted.add(dst);
      this.note(
        3,
        onLink
          ? `${dst} is on my own subnet (${iface.ip}/${iface.prefix}), so I deliver directly: next hop is ${dst} itself.`
          : `${dst} is NOT on my subnet (${iface.ip}/${iface.prefix}), so I hand the packet to my default gateway ${nextHop}. The IP destination stays ${dst}; only the MAC address will be the gateway's.`,
      );
    }
    const packet = encodeIpv4({
      id: this.nextIpId(),
      dontFragment: opts.dontFragment,
      ttl: opts.ttl ?? 64,
      protocol,
      src: iface.ip,
      dst,
      payload,
    });
    this.resolveAndSend(iface, nextHop, packet);
    return true;
  }

  sendUdp(dstIp: string, srcPort: number, dstPort: number, payload: Bytes) {
    this.sendIp(dstIp, IP_PROTO_UDP, encodeUdp(this.ip, dstIp, srcPort, dstPort, payload));
  }

  sendPing(dstIp: string, id: number, seq: number, data: Bytes) {
    this.sendIp(dstIp, IP_PROTO_ICMP, encodeIcmpEcho(ICMP_ECHO_REQUEST, id, seq, data));
  }

  receive(iface: Iface, frame: Bytes) {
    const eth = parseEthernet(frame);
    if (!eth) return;
    const forMe = eth.dst === iface.mac;
    if (!forMe && eth.dst !== BROADCAST_MAC) {
      this.note(2, `This frame is addressed to ${eth.dst}, not to my MAC ${iface.mac}. My network card ignores it.`);
      return;
    }
    if (eth.etherType === ETHERTYPE_ARP) this.handleArp(iface, eth.payload);
    else if (eth.etherType === ETHERTYPE_IPV4) this.handleIpv4(iface, eth.payload);
  }

  private handleIpv4(iface: Iface, bytes: Bytes) {
    const ip = parseIpv4(bytes);
    if (!ip) return;
    if (!this.validIpHeader(ip)) {
      this.note(3, "IP header checksum does not verify, so the packet is discarded.");
      return;
    }
    if (ip.dst !== iface.ip) {
      this.note(3, `IP destination ${ip.dst} is not my address, and hosts do not forward packets. Dropped.`);
      return;
    }
    if (ip.protocol === IP_PROTO_ICMP) this.handleIcmp(ip);
    else if (ip.protocol === IP_PROTO_UDP) this.handleUdp(ip);
    else if (ip.protocol === IP_PROTO_TCP) {
      const seg = parseTcp(ip.payload);
      if (seg && l4ChecksumValid(ip.src, ip.dst, IP_PROTO_TCP, ip.payload)) this.tcp.input(ip.src, ip.dst, seg);
      else this.note(4, "TCP checksum does not verify, so the segment is discarded.");
    }
  }

  private handleIcmp(ip: ParsedIpv4) {
    const m = ip.payload;
    if (m.length < 8 || internetChecksum(m) !== 0) return;
    const type = m[0] ?? 0;
    if (type === ICMP_ECHO_REQUEST) {
      this.note(3, `ICMP echo request from ${ip.src}. The IP layer answers by itself, with no application involved.`);
      this.sendIp(ip.src, IP_PROTO_ICMP, encodeIcmpEcho(ICMP_ECHO_REPLY, u16(m, 4), u16(m, 6), m.subarray(8)));
    } else if (type === ICMP_ECHO_REPLY) {
      this.pingListeners.get(u16(m, 4))?.({ from: ip.src, seq: u16(m, 6), ttl: ip.ttl, bytes: m.length });
    } else if (type === ICMP_TIME_EXCEEDED) {
      this.note(3, `ICMP "time exceeded" from ${ip.src}: a packet of mine ran out of TTL on the way.`);
    } else if (type === ICMP_DEST_UNREACHABLE) {
      this.note(3, `ICMP "destination unreachable" (code ${m[1] ?? 0}) from ${ip.src}.`);
    }
  }

  private handleUdp(ip: ParsedIpv4) {
    const d = ip.payload;
    if (d.length < 8) return;
    const checksum = u16(d, 6);
    if (checksum !== 0 && !l4ChecksumValid(ip.src, ip.dst, IP_PROTO_UDP, d)) {
      this.note(4, "UDP checksum does not verify, so the datagram is discarded.");
      return;
    }
    const dport = u16(d, 2);
    const handler = this.udp.get(dport);
    if (!handler) {
      this.note(4, `Nothing is listening on UDP port ${dport}. I tell the sender with ICMP "port unreachable".`);
      this.sendIp(ip.src, IP_PROTO_ICMP, encodeIcmpError(ICMP_DEST_UNREACHABLE, 3, ip.raw));
      return;
    }
    handler(ip.src, u16(d, 0), d.subarray(8));
  }
}

// ---- switch ---------------------------------------------------------------------------

export class Switch extends Device {
  readonly macTable = new Map<string, number>();

  constructor(id: string, name: string, net: Network) {
    super(id, name, "switch", net);
  }

  receive(iface: Iface, frame: Bytes) {
    if (frame.length < 14) return;
    const dst = bytesToMac(frame, 0);
    const src = bytesToMac(frame, 6);

    if (this.macTable.get(src) !== iface.index) {
      this.macTable.set(src, iface.index);
      this.state("mac", "set", src, iface.name);
      this.note(2, `Learned: ${src} lives behind port ${iface.name}. Next time a frame is addressed to it, I will send it only there.`);
    }

    const isBroadcast = dst === BROADCAST_MAC;
    const known = this.macTable.get(dst);

    if (!isBroadcast && known !== undefined) {
      if (known === iface.index) {
        this.note(2, `${dst} is on the same port the frame arrived from, so there is no need to forward it. Filtered.`);
        return;
      }
      this.note(2, `${dst} is in my MAC table on port ${this.ifaces[known]?.name}. Forwarding out of that one port only.`);
      this.forward([this.ifaces[known] as Iface], frame);
      return;
    }

    this.note(
      2,
      isBroadcast
        ? `Broadcast destination (${dst}): I flood it out of every port except ${iface.name}.`
        : `${dst} is not in my MAC table yet (unknown unicast): I flood it out of every port except ${iface.name}.`,
    );
    this.forward(
      this.ifaces.filter((p) => p !== iface && p.link),
      frame,
    );
  }

  private forward(ports: Iface[], frame: Bytes) {
    this.net.later(5, () => {
      for (const port of ports) this.net.transmit(port, frame);
    });
  }
}

// ---- router ---------------------------------------------------------------------------

export interface Route {
  network: number;
  prefix: number;
  nextHop?: string;
  iface: Iface;
  kind: "connected" | "static";
}

export class Router extends IpNode {
  readonly routes: Route[] = [];

  constructor(id: string, name: string, net: Network) {
    super(id, name, "router", net);
  }

  protected override onIfaceAdded(iface: Iface) {
    if (iface.ip && iface.prefix !== undefined) {
      this.addRoute({ network: networkOf(iface.ip, iface.prefix), prefix: iface.prefix, iface, kind: "connected" });
    }
  }

  addStatic(cidr: string, nextHop: string, via: Iface) {
    const [ip, p] = cidr.split("/") as [string, string];
    this.addRoute({ network: networkOf(ip, Number(p)), prefix: Number(p), nextHop, iface: via, kind: "static" });
  }

  private addRoute(route: Route) {
    this.routes.push(route);
    this.state(
      "route",
      "set",
      `${intToIp(route.network)}/${route.prefix}`,
      `${route.kind === "connected" ? "directly connected" : `via ${route.nextHop}`} on ${route.iface.name}`,
    );
  }

  // Longest-prefix match: the most specific route that contains the destination wins.
  lookup(dst: string): Route | undefined {
    const d = ipToInt(dst);
    let best: Route | undefined;
    for (const r of this.routes) {
      if (((d & prefixToMask(r.prefix)) >>> 0) !== r.network) continue;
      if (!best || r.prefix > best.prefix) best = r;
    }
    return best;
  }

  receive(iface: Iface, frame: Bytes) {
    const eth = parseEthernet(frame);
    if (!eth) return;
    if (eth.dst !== iface.mac && eth.dst !== BROADCAST_MAC) return;
    if (eth.etherType === ETHERTYPE_ARP) this.handleArp(iface, eth.payload);
    else if (eth.etherType === ETHERTYPE_IPV4) this.handleIpv4(iface, eth.payload);
  }

  private handleIpv4(iface: Iface, bytes: Bytes) {
    const ip = parseIpv4(bytes);
    if (!ip) return;
    if (!this.validIpHeader(ip)) {
      this.note(3, "IP header checksum does not verify, so the packet is discarded.");
      return;
    }
    const mine = this.ifaces.some((i) => i.ip === ip.dst);
    if (mine) {
      this.deliverLocally(ip);
      return;
    }
    this.net.later(20, () => this.forward(iface, ip));
  }

  private deliverLocally(ip: ParsedIpv4) {
    const m = ip.payload;
    if (ip.protocol === IP_PROTO_ICMP && (m[0] ?? 0) === ICMP_ECHO_REQUEST && internetChecksum(m) === 0) {
      this.note(3, `Echo request addressed to the router itself (${ip.dst}). It answers.`);
      this.originate(ip.src, IP_PROTO_ICMP, encodeIcmpEcho(ICMP_ECHO_REPLY, u16(m, 4), u16(m, 6), m.subarray(8)), ip.dst);
    }
  }

  private forward(inIface: Iface, ip: ParsedIpv4) {
    if (ip.ttl <= 1) {
      this.note(3, `TTL is ${ip.ttl}: it would reach 0 here, so I discard the packet and tell the sender with ICMP "time exceeded". This is the mechanism traceroute uses.`);
      this.originate(ip.src, IP_PROTO_ICMP, encodeIcmpError(ICMP_TIME_EXCEEDED, 0, ip.raw), inIface.ip);
      return;
    }
    const route = this.lookup(ip.dst);
    if (!route) {
      this.note(3, `No route to ${ip.dst}. Dropped, and the sender is told with ICMP "network unreachable".`);
      this.originate(ip.src, IP_PROTO_ICMP, encodeIcmpError(ICMP_DEST_UNREACHABLE, 0, ip.raw), inIface.ip);
      return;
    }
    const nextHop = route.nextHop ?? ip.dst;
    this.note(
      3,
      `Routing table lookup for ${ip.dst}: the longest matching route is ${intToIp(route.network)}/${route.prefix} (${maskToDotted(route.prefix)}), ${
        route.kind === "connected" ? "directly connected" : `via ${route.nextHop}`
      }, out of ${route.iface.name}. TTL ${ip.ttl} becomes ${ip.ttl - 1} and the header checksum is recalculated.`,
    );
    const out = rewriteIpv4Ttl(ip.raw, ip.ttl - 1);
    this.resolveAndSend(route.iface, nextHop, out);
  }

  // A packet the router creates itself (ICMP replies and errors).
  private originate(dst: string, protocol: number, payload: Bytes, src?: string) {
    const route = this.lookup(dst);
    if (!route) return;
    const from = src ?? route.iface.ip;
    if (!from) return;
    const packet = encodeIpv4({ id: this.nextIpId(), ttl: 64, protocol, src: from, dst, payload });
    this.resolveAndSend(route.iface, route.nextHop ?? dst, packet);
  }
}


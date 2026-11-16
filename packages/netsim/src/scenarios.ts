import { Rng, Network, type Frame, type TraceEvent } from "./sim/core";
import { Host, Router, Switch } from "./sim/nodes";
import { httpGet, ping, startDnsServer, startHttpServer } from "./sim/apps";

// ---- the lab network ---------------------------------------------------------------------
//
//   PC-A ─┐                                                 ┌─ Web server  10.0.0.10
//         ├─ SW1 ─── R1 ──────────── SW2 ──────────────────┤
//   PC-B ─┘   192.168.1.0/24   10.0.0.0/24                  └─ DNS server  10.0.0.53
//
// Two separate LANs joined by one router: enough to show broadcast domains, switching,
// ARP, routing and TTL without hiding any device's behaviour.

export const WEB_HOSTNAME = "www.lab.example"; // .example is reserved for documentation (RFC 2606)

export interface Lab {
  net: Network;
  pcA: Host;
  pcB: Host;
  sw1: Switch;
  r1: Router;
  sw2: Switch;
  web: Host;
  dns: Host;
}

export interface LabOptions {
  seed: number;
  lossPct?: number; // loss on the router-to-SW2 link
}

export function buildLab(opts: LabOptions): Lab {
  const net = new Network(opts.seed);
  const pcA = net.add(new Host("pc-a", "PC-A", net));
  const pcB = net.add(new Host("pc-b", "PC-B", net));
  const sw1 = net.add(new Switch("sw1", "SW1", net));
  const r1 = net.add(new Router("r1", "R1", net));
  const sw2 = net.add(new Switch("sw2", "SW2", net));
  const web = net.add(new Host("web", "Web server", net));
  const dns = net.add(new Host("dns", "DNS server", net));

  const a0 = pcA.addIface("eth0", "02:00:00:00:0a:01", "192.168.1.10", 24);
  const b0 = pcB.addIface("eth0", "02:00:00:00:0b:01", "192.168.1.20", 24);
  const s1p1 = sw1.addIface("fa0/1", "02:00:00:00:51:01");
  const s1p2 = sw1.addIface("fa0/2", "02:00:00:00:51:02");
  const s1p3 = sw1.addIface("fa0/3", "02:00:00:00:51:03");
  const r0 = r1.addIface("gi0/0", "02:00:00:00:f1:00", "192.168.1.1", 24);
  const r1i = r1.addIface("gi0/1", "02:00:00:00:f1:01", "10.0.0.1", 24);
  const s2p1 = sw2.addIface("fa0/1", "02:00:00:00:52:01");
  const s2p2 = sw2.addIface("fa0/2", "02:00:00:00:52:02");
  const s2p3 = sw2.addIface("fa0/3", "02:00:00:00:52:03");
  const w0 = web.addIface("eth0", "02:00:00:00:c0:01", "10.0.0.10", 24);
  const d0 = dns.addIface("eth0", "02:00:00:00:d0:01", "10.0.0.53", 24);

  net.connect(a0, s1p1, { delayUs: 50, bps: 100_000_000 });
  net.connect(b0, s1p2, { delayUs: 50, bps: 100_000_000 });
  net.connect(s1p3, r0, { delayUs: 50, bps: 100_000_000 });
  net.connect(r1i, s2p1, { delayUs: 200, bps: 1_000_000_000, lossPct: opts.lossPct ?? 0 });
  net.connect(s2p2, w0, { delayUs: 50, bps: 100_000_000 });
  net.connect(s2p3, d0, { delayUs: 50, bps: 100_000_000 });

  pcA.gateway = "192.168.1.1";
  pcA.dnsServer = "10.0.0.53";
  pcB.gateway = "192.168.1.1";
  pcB.dnsServer = "10.0.0.53";
  web.gateway = "10.0.0.1";
  dns.gateway = "10.0.0.1";

  startDnsServer(dns, { [WEB_HOSTNAME]: "10.0.0.10" });
  startHttpServer(web, WEB_HOSTNAME);

  return { net, pcA, pcB, sw1, r1, sw2, web, dns };
}

// ---- scenarios -----------------------------------------------------------------------------

export interface Scenario {
  id: string;
  title: string;
  level: "Beginner" | "Intermediate";
  summary: string;
  command: string; // what the learner "types"
  learn: string[];
  layers: number[]; // OSI layers exercised
  run(lab: Lab): void;
}

const START_US = 1000;

export const SCENARIOS: Scenario[] = [
  {
    id: "ping-lan",
    title: "Ping a neighbour on the same LAN",
    level: "Beginner",
    summary: "The smallest complete conversation: how one computer finds another on its own network and checks it is alive.",
    command: "ping 192.168.1.20",
    learn: [
      "Why a computer must ask for a MAC address (ARP) before it can send anything",
      "How a switch learns which port each device is on, and floods what it does not know",
      "That ping is ICMP: an echo request and an echo reply, inside IP, inside Ethernet",
    ],
    layers: [2, 3],
    run: ({ net, pcA }) => {
      net.sched.at(START_US, () => ping(pcA, "192.168.1.20", { count: 3, intervalMs: 1000 }));
    },
  },
  {
    id: "ping-router",
    title: "Ping across a router",
    level: "Beginner",
    summary: "Reach a server on a different network: the default gateway, the routing table, and a TTL that drops at every hop.",
    command: "ping 10.0.0.10",
    learn: [
      "Why the destination IP stays the same but the destination MAC changes at every hop",
      "How a router chooses an exit with its routing table (longest prefix match)",
      "What TTL is for, and why the reply arrives with a lower one",
    ],
    layers: [2, 3],
    run: ({ net, pcA }) => {
      net.sched.at(START_US, () => ping(pcA, "10.0.0.10", { count: 2, intervalMs: 1000 }));
    },
  },
  {
    id: "web-page",
    title: "Open a web page, A to Z",
    level: "Intermediate",
    summary: "Everything that happens between pressing Enter on a URL and the page arriving: DNS, ARP, routing, the TCP handshake, HTTP, and the goodbye.",
    command: `curl http://${WEB_HOSTNAME}/`,
    learn: [
      "How a name becomes an address (DNS over UDP)",
      "The TCP three-way handshake, sequence numbers and acknowledgments",
      "How an HTTP response bigger than one segment is split and acknowledged",
      "How a connection is closed, and why TIME_WAIT exists",
    ],
    layers: [1, 2, 3, 4, 7],
    run: ({ net, pcA }) => {
      net.sched.at(START_US, () => httpGet(pcA, `http://${WEB_HOSTNAME}/`));
    },
  },
];

// ---- running and packaging a trace --------------------------------------------------------

export interface IfaceInfo {
  name: string;
  mac: string;
  ip?: string;
  prefix?: number;
}

export interface DeviceInfo {
  id: string;
  name: string;
  kind: "host" | "switch" | "router";
  ifaces: IfaceInfo[];
  gateway?: string;
  dnsServer?: string;
}

export interface LinkInfo {
  id: string;
  a: { device: string; iface: string };
  b: { device: string; iface: string };
  delayUs: number;
  bps: number;
  lossPct: number;
  mtu: number;
}

export interface Trace {
  scenarioId: string;
  title: string;
  command: string;
  seed: number;
  devices: DeviceInfo[];
  links: LinkInfo[];
  frames: Frame[];
  events: TraceEvent[];
  endTime: number; // microseconds of model time
}

export interface RunOptions {
  seed?: number;
  lossPct?: number;
  maxSeconds?: number;
}

export function runScenario(id: string, opts: RunOptions = {}): Trace {
  const scenario = SCENARIOS.find((s) => s.id === id);
  if (!scenario) throw new Error(`Unknown scenario: ${id}`);
  const seed = opts.seed ?? 20261123;
  const lab = buildLab({ seed, lossPct: opts.lossPct });
  scenario.run(lab);
  const endTime = lab.net.sched.run((opts.maxSeconds ?? 120) * 1_000_000);

  const devices: DeviceInfo[] = [...lab.net.devices.values()].map((d) => ({
    id: d.id,
    name: d.name,
    kind: d.kind,
    ifaces: d.ifaces.map((i) => ({ name: i.name, mac: i.mac, ip: i.ip, prefix: i.prefix })),
    gateway: d instanceof Host ? d.gateway : undefined,
    dnsServer: d instanceof Host ? d.dnsServer : undefined,
  }));
  const links: LinkInfo[] = lab.net.links.map((l) => ({
    id: l.id,
    a: { device: l.a.device.id, iface: l.a.name },
    b: { device: l.b.device.id, iface: l.b.name },
    delayUs: l.delayUs,
    bps: l.bps,
    lossPct: l.lossPct,
    mtu: l.mtu,
  }));
  return {
    scenarioId: scenario.id,
    title: scenario.title,
    command: scenario.command,
    seed,
    devices,
    links,
    frames: lab.net.rec.frames,
    events: lab.net.rec.events,
    endTime,
  };
}

export { Rng };

import { ascii, fromAscii, type Bytes } from "../bytes";
import { encodeDnsQuery, encodeDnsResponse, parseDns } from "../codecs";
import type { Host } from "./nodes";
import type { TcpConn } from "./tcp";

// ---- DNS ------------------------------------------------------------------------------

// A single authoritative-style server answering A queries from a fixed zone. Real name
// resolution is recursive across several servers; the lab collapses it to one answer so
// the focus stays on the packets.
export function startDnsServer(host: Host, zone: Record<string, string>) {
  host.udp.set(53, (srcIp, srcPort, payload) => {
    const q = parseDns(payload);
    if (!q || q.isResponse) return;
    const ip = zone[q.name] ?? null;
    host.note(
      7,
      ip
        ? `DNS query for ${q.name}. I look it up in my zone and answer with an A record: ${ip}, valid for 300 seconds (the TTL).`
        : `DNS query for ${q.name}, which is not in my zone. I answer NXDOMAIN (name does not exist).`,
    );
    host.sendUdp(srcIp, 53, srcPort, encodeDnsResponse(q.id, q.name, ip, 300));
  });
  host.note(7, "DNS service started: listening on UDP port 53.");
}

export function resolveName(host: Host, name: string, done: (ip: string | null) => void) {
  const cached = host.dnsCache.get(name);
  if (cached) {
    host.note(7, `DNS cache hit: ${name} is ${cached}. No query needs to be sent.`);
    done(cached);
    return;
  }
  const server = host.dnsServer;
  if (!server) {
    host.note(7, "No DNS server is configured, so the name cannot be resolved.");
    done(null);
    return;
  }
  const net = host.network;
  const id = net.rng.int(0xffff);
  const port = host.newEphemeralPort();
  let answered = false;
  host.udp.set(port, (_src, _sport, payload) => {
    const r = parseDns(payload);
    if (!r || !r.isResponse || r.id !== id) return;
    answered = true;
    host.udp.delete(port);
    const ip = r.answers[0] ?? null;
    if (ip) {
      host.dnsCache.set(name, ip);
      host.state("dns", "set", name, `${ip} (TTL 300 s)`);
      host.note(7, `DNS answer received: ${name} is ${ip}. I store it in my cache for the TTL.`);
    } else host.note(7, `DNS says ${name} does not exist.`);
    done(ip);
  });
  host.note(7, `DNS cache miss for ${name}. I ask my DNS server ${server} over UDP port 53 (DNS uses UDP for small queries: no handshake needed).`);
  const query = encodeDnsQuery(id, name);
  const attempt = (n: number) => {
    host.sendUdp(server, port, 53, query);
    net.later(1_000_000, () => {
      if (answered) return;
      if (n < 3) {
        host.note(7, `No DNS answer after 1 s. The query or the reply may have been lost, so I ask again (attempt ${n + 1} of 3). UDP has no retransmission of its own: the application must do it.`);
        attempt(n + 1);
      } else {
        host.udp.delete(port);
        host.note(7, `DNS query for ${name} timed out.`);
        done(null);
      }
    });
  };
  attempt(1);
}

// ---- HTTP -----------------------------------------------------------------------------

const HTTP_DATE = "Mon, 23 Nov 2026 09:00:00 GMT";

export function samplePage(host: string, path: string): { status: number; body: string } {
  if (path !== "/" && path !== "/index.html") {
    return { status: 404, body: "<html><body><h1>404 Not Found</h1></body></html>\n" };
  }
  const paragraph =
    "Every request in this lab is carried by real TCP segments, real IP packets and real Ethernet frames. " +
    "Open any packet in the list to see its header fields, its raw bytes and the layer that added each part.";
  const lines: string[] = [];
  for (let i = 1; i <= 14; i++) lines.push(`    <p>Section ${i}. ${paragraph}</p>`);
  return {
    status: 200,
    body: `<!doctype html>\n<html>\n  <head><title>Welcome to ${host}</title></head>\n  <body>\n    <h1>Hello from ${host}</h1>\n${lines.join("\n")}\n  </body>\n</html>\n`,
  };
}

export function startHttpServer(host: Host, hostname: string) {
  host.tcp.listen(80, (conn) => {
    let received = "";
    conn.handlers.onData = (c, data) => {
      received += fromAscii(data);
      if (!received.includes("\r\n\r\n")) return;
      const [method = "GET", path = "/"] = (received.split("\r\n")[0] ?? "").split(" ");
      const page = samplePage(hostname, path);
      const reason = page.status === 200 ? "OK" : "Not Found";
      host.note(7, `HTTP request: ${method} ${path}. I build the response: status ${page.status}, then headers, a blank line and ${page.body.length} bytes of HTML.`);
      const head =
        `HTTP/1.1 ${page.status} ${reason}\r\n` +
        `Date: ${HTTP_DATE}\r\nServer: PacketLab/1.0\r\nContent-Type: text/html; charset=utf-8\r\n` +
        `Content-Length: ${page.body.length}\r\nConnection: close\r\n\r\n`;
      c.send(ascii(head + page.body));
      c.close();
    };
  });
}

export interface HttpResult {
  status: number;
  bodyBytes: number;
}

export function httpGet(host: Host, url: string, done?: (r: HttpResult | null) => void) {
  const m = /^http:\/\/([^/:]+)(?::(\d+))?(\/.*)?$/.exec(url);
  if (!m) throw new Error(`Unsupported URL: ${url}`);
  const name = m[1] as string;
  const port = m[2] ? Number(m[2]) : 80;
  const path = m[3] ?? "/";
  const net = host.network;

  net.phase(
    "1 · You press Enter",
    `The command curl ${url} starts. The application layer knows a name (${name}) but the network can only deliver to numbers, so the first job is to find the IP address.`,
  );
  net.phase(
    "2 · Name to address (DNS)",
    `The resolver asks the DNS server for ${name}. To reach that server the host must first discover the MAC address of its default gateway with ARP, because the server is on another network.`,
  );
  resolveName(host, name, (ip) => {
    if (!ip) {
      done?.(null);
      return;
    }
    net.phase(
      "3 · Open a reliable connection (TCP)",
      `With ${ip} known, TCP performs the three-way handshake (SYN, SYN+ACK, ACK) so both ends agree on starting sequence numbers before any data flows.`,
    );
    let response = "";
    host.tcp.connect(ip, port, {
      onOpen: (c: TcpConn) => {
        net.phase(
          "4 · Ask for the page (HTTP)",
          "The connection is open. The client sends one HTTP request as plain text inside a TCP segment; the server answers with a status line, headers and the page body, split into several segments if it does not fit in one.",
        );
        const req = `GET ${path} HTTP/1.1\r\nHost: ${name}\r\nUser-Agent: curl/8.5.0\r\nAccept: */*\r\nConnection: close\r\n\r\n`;
        host.note(7, `I write an HTTP request: GET ${path}, with the Host header so a server hosting many sites knows which one I mean.`);
        c.send(ascii(req));
      },
      onData: (_c: TcpConn, data: Bytes) => {
        response += fromAscii(data);
      },
      onRemoteClose: (c: TcpConn) => {
        net.phase(
          "5 · Say goodbye (TCP teardown)",
          "The server sent its last byte and closed its side with FIN. The client acknowledges, closes its own side, and the connection winds down through FIN_WAIT, CLOSE_WAIT, LAST_ACK and TIME_WAIT.",
        );
        c.close();
      },
      onClosed: () => {
        const status = Number(/^HTTP\/1\.1 (\d{3})/.exec(response)?.[1] ?? 0);
        const body = response.split("\r\n\r\n").slice(1).join("\r\n\r\n");
        host.note(7, `Download complete: status ${status}, ${body.length} bytes of body. The browser would now parse and render the page.`);
        done?.({ status, bodyBytes: body.length });
      },
    });
  });
}

// ---- ping -----------------------------------------------------------------------------

const PING_PAYLOAD = ascii("abcdefghijklmnopqrstuvwabcdefghi");

export function ping(host: Host, target: string, opts: { count?: number; intervalMs?: number } = {}) {
  const count = opts.count ?? 3;
  const intervalUs = (opts.intervalMs ?? 1000) * 1000;
  const net = host.network;
  const id = net.rng.int(0xffff);
  const sentAt = new Map<number, number>();

  net.phase("ping", `ping ${target}: send ${count} ICMP echo requests and time the replies.`);
  host.pingListeners.set(id, (r) => {
    const t0 = sentAt.get(r.seq) ?? net.now();
    const rtt = ((net.now() - t0) / 1000).toFixed(3);
    host.note(3, `Echo reply ${r.seq} from ${r.from}: ${r.bytes} bytes, TTL ${r.ttl}, round trip ${rtt} ms.`);
  });
  for (let seq = 1; seq <= count; seq++) {
    net.sched.after((seq - 1) * intervalUs, () => {
      sentAt.set(seq, net.now());
      host.note(3, `ping: sending echo request ${seq} of ${count} to ${target}.`);
      host.sendPing(target, id, seq, PING_PAYLOAD);
    });
  }
}

import type { Bytes } from "../bytes";
import {
  IP_PROTO_TCP,
  TCP_ACK,
  TCP_FIN,
  TCP_PSH,
  TCP_RST,
  TCP_SYN,
  encodeTcp,
  type ParsedTcp,
} from "../codecs";
import type { Network, TableName } from "./core";

// A compact but faithful TCP (RFC 9293): the full connection state machine, sequence and
// acknowledgement arithmetic, MSS segmentation, slow start, delayed ACKs and a
// retransmission timer. Not implemented: window scaling, SACK, timestamps, congestion
// avoidance beyond slow start, and out-of-order buffering (out-of-order data is answered
// with a duplicate ACK and must be retransmitted).

export interface TcpHost {
  readonly id: string;
  readonly ip: string;
  readonly network: Network;
  sendIp(dst: string, protocol: number, payload: Bytes, opts?: { ttl?: number; dontFragment?: boolean }): boolean;
  note(layer: number | null, text: string): void;
  state(table: TableName, op: "set" | "del", key: string, value: string): void;
  newEphemeralPort(): number;
}

export type TcpState =
  | "LISTEN"
  | "SYN_SENT"
  | "SYN_RCVD"
  | "ESTABLISHED"
  | "FIN_WAIT_1"
  | "FIN_WAIT_2"
  | "CLOSE_WAIT"
  | "CLOSING"
  | "LAST_ACK"
  | "TIME_WAIT"
  | "CLOSED";

export interface TcpHandlers {
  onOpen?(c: TcpConn): void;
  onData?(c: TcpConn, data: Bytes): void;
  onRemoteClose?(c: TcpConn): void;
  onClosed?(c: TcpConn): void;
}

interface Unacked {
  seq: number;
  seqLen: number;
  flags: number;
  data: Bytes;
  mss?: number;
}

const LOCAL_MSS = 1460; // 1500-byte MTU minus 20 bytes of IP header and 20 of TCP header
const RECEIVE_WINDOW = 64240;
const INITIAL_RTO_US = 1_000_000;
const DELAYED_ACK_US = 40_000;
const TWO_MSL_US = 60_000_000;
const MAX_RETRIES = 5;
const INITIAL_CWND_SEGMENTS = 10; // RFC 6928

const add = (a: number, b: number) => (a + b) >>> 0;
const seqLt = (a: number, b: number) => ((a - b) | 0) < 0;
const seqLe = (a: number, b: number) => ((a - b) | 0) <= 0;

export class TcpConn {
  state: TcpState = "CLOSED";
  iss = 0;
  irs = 0;
  sndUna = 0;
  sndNxt = 0;
  rcvNxt = 0;
  mss = LOCAL_MSS;
  peerWindow = RECEIVE_WINDOW;
  cwnd = INITIAL_CWND_SEGMENTS * LOCAL_MSS;
  ssthresh = 65535;
  pending: Bytes = new Uint8Array(0);
  finQueued = false;
  finSent = false;
  finSeq = 0;
  rtx: Unacked[] = [];
  rto = INITIAL_RTO_US;
  retries = 0;
  timerToken = 0;
  delAckToken = 0;
  unackedSegments = 0;
  ackedUpTo = 0; // highest receive-side sequence number already acknowledged to the peer
  handlers: TcpHandlers = {};

  constructor(
    private readonly stack: TcpStack,
    readonly localIp: string,
    readonly localPort: number,
    readonly remoteIp: string,
    readonly remotePort: number,
  ) {}

  get key() {
    return `${this.localIp}:${this.localPort} ↔ ${this.remoteIp}:${this.remotePort}`;
  }

  send(data: Bytes) {
    this.stack.queueData(this, data);
  }

  close() {
    this.stack.queueClose(this);
  }
}

export class TcpStack {
  private readonly conns = new Map<string, TcpConn>();
  private readonly listeners = new Map<number, (c: TcpConn) => void>();

  constructor(private readonly host: TcpHost) {}

  private get net() {
    return this.host.network;
  }

  listen(port: number, onAccept: (c: TcpConn) => void) {
    this.listeners.set(port, onAccept);
    this.host.state("tcp", "set", `*:${port}`, "LISTEN");
    this.host.note(4, `TCP server socket is now in LISTEN state on port ${port}, waiting for a SYN.`);
  }

  connect(remoteIp: string, remotePort: number, handlers: TcpHandlers): TcpConn {
    const c = new TcpConn(this, this.host.ip, this.host.newEphemeralPort(), remoteIp, remotePort);
    c.handlers = handlers;
    c.iss = this.net.rng.u32();
    c.sndUna = c.iss;
    c.sndNxt = add(c.iss, 1);
    this.conns.set(this.connKey(c.localPort, remoteIp, remotePort), c);
    this.setState(c, "SYN_SENT");
    this.host.note(
      4,
      `Active open: I pick source port ${c.localPort} and a starting sequence number. The SYN also carries my MSS (${LOCAL_MSS} bytes), the largest segment I can accept.`,
    );
    this.sendSegment(c, TCP_SYN, c.iss, undefined, LOCAL_MSS);
    c.rtx.push({ seq: c.iss, seqLen: 1, flags: TCP_SYN, data: new Uint8Array(0), mss: LOCAL_MSS });
    this.armTimer(c);
    return c;
  }

  queueData(c: TcpConn, data: Bytes) {
    const merged = new Uint8Array(c.pending.length + data.length);
    merged.set(c.pending, 0);
    merged.set(data, c.pending.length);
    c.pending = merged;
    this.pump(c);
  }

  queueClose(c: TcpConn) {
    if (c.finQueued) return;
    c.finQueued = true;
    this.pump(c);
  }

  // ---- input ------------------------------------------------------------------------

  input(srcIp: string, _dstIp: string, seg: ParsedTcp) {
    const existing = this.conns.get(this.connKey(seg.dstPort, srcIp, seg.srcPort));
    if (existing) {
      this.segmentArrives(existing, seg);
      return;
    }
    if (seg.flags & TCP_RST) return;
    const onAccept = this.listeners.get(seg.dstPort);
    if (onAccept && seg.flags & TCP_SYN && !(seg.flags & TCP_ACK)) {
      this.accept(onAccept, srcIp, seg);
      return;
    }
    this.host.note(4, `No connection and nothing listening on TCP port ${seg.dstPort}: I answer with RST.`);
    this.sendReset(srcIp, seg);
  }

  private accept(onAccept: (c: TcpConn) => void, srcIp: string, seg: ParsedTcp) {
    const c = new TcpConn(this, this.host.ip, seg.dstPort, srcIp, seg.srcPort);
    c.iss = this.net.rng.u32();
    c.irs = seg.seq;
    c.rcvNxt = add(seg.seq, 1);
    c.sndUna = c.iss;
    c.sndNxt = add(c.iss, 1);
    c.peerWindow = seg.window;
    if (seg.mss) c.mss = Math.min(LOCAL_MSS, seg.mss);
    this.conns.set(this.connKey(c.localPort, srcIp, seg.srcPort), c);
    this.setState(c, "SYN_RCVD");
    onAccept(c);
    this.host.note(
      4,
      `SYN received on a listening port: I create a connection record, choose my own starting sequence number, and reply SYN+ACK acknowledging theirs plus one.`,
    );
    this.sendSegment(c, TCP_SYN | TCP_ACK, c.iss, undefined, LOCAL_MSS);
    c.rtx.push({ seq: c.iss, seqLen: 1, flags: TCP_SYN | TCP_ACK, data: new Uint8Array(0), mss: LOCAL_MSS });
    this.armTimer(c);
  }

  private segmentArrives(c: TcpConn, seg: ParsedTcp) {
    if (seg.flags & TCP_RST) {
      this.host.note(4, "RST received: the peer refuses or aborts this connection.");
      this.destroy(c);
      return;
    }

    if (c.state === "SYN_SENT") {
      if ((seg.flags & (TCP_SYN | TCP_ACK)) === (TCP_SYN | TCP_ACK) && seg.ack === add(c.iss, 1)) {
        c.irs = seg.seq;
        c.rcvNxt = add(seg.seq, 1);
        c.sndUna = seg.ack;
        c.peerWindow = seg.window;
        if (seg.mss) c.mss = Math.min(LOCAL_MSS, seg.mss);
        c.rtx = [];
        c.timerToken++;
        this.host.note(4, `SYN+ACK received. Three-way handshake step 3: I acknowledge their sequence number plus one. Both sides now agree on the starting numbers and the MSS (${c.mss}).`);
        this.setState(c, "ESTABLISHED");
        this.sendAck(c);
        c.handlers.onOpen?.(c);
        this.pump(c);
      }
      return;
    }

    if (c.state === "SYN_RCVD") {
      if (!(seg.flags & TCP_ACK) || seg.ack !== add(c.iss, 1)) return;
      c.sndUna = seg.ack;
      c.peerWindow = seg.window;
      c.rtx = [];
      c.timerToken++;
      this.host.note(4, "Final ACK of the handshake received: the connection is ESTABLISHED on both sides.");
      this.setState(c, "ESTABLISHED");
      c.handlers.onOpen?.(c);
    }

    if (seg.flags & TCP_ACK) this.processAck(c, seg.ack, seg.window);

    const len = seg.payload.length;
    const canReceive = c.state === "ESTABLISHED" || c.state === "FIN_WAIT_1" || c.state === "FIN_WAIT_2";
    if (len > 0 && canReceive) {
      if (seg.seq === c.rcvNxt) {
        c.rcvNxt = add(c.rcvNxt, len);
        c.handlers.onData?.(c, seg.payload);
        c.unackedSegments++;
        // The application may already have replied: data segments carry an ACK, so a separate
        // pure ACK is only needed if nothing has acknowledged these bytes yet.
        if (c.ackedUpTo === c.rcvNxt) c.unackedSegments = 0;
        else if (!(seg.flags & TCP_FIN)) {
          if (c.unackedSegments >= 2 || seg.flags & TCP_PSH) this.sendAck(c);
          else this.armDelayedAck(c);
        }
      } else {
        this.host.note(4, "Segment is not the next expected byte. I re-send my last ACK (a duplicate ACK) so the sender knows what is missing.");
        this.sendAck(c);
        return;
      }
    }

    if (seg.flags & TCP_FIN && add(seg.seq, len) === c.rcvNxt) {
      c.rcvNxt = add(c.rcvNxt, 1);
      this.host.note(4, "FIN received: the peer has finished sending. A FIN occupies one sequence number, so I acknowledge it.");
      this.sendAck(c);
      if (c.state === "ESTABLISHED") this.setState(c, "CLOSE_WAIT");
      else if (c.state === "FIN_WAIT_1") this.setState(c, "CLOSING");
      else if (c.state === "FIN_WAIT_2") this.enterTimeWait(c);
      c.handlers.onRemoteClose?.(c);
    }
  }

  // ---- sending ------------------------------------------------------------------------

  private pump(c: TcpConn) {
    if (c.state !== "ESTABLISHED" && c.state !== "CLOSE_WAIT") return;
    while (c.pending.length > 0) {
      const inflight = (c.sndNxt - c.sndUna) >>> 0;
      const window = Math.min(c.cwnd, c.peerWindow);
      const room = window - inflight;
      if (room <= 0) break;
      const n = Math.min(c.mss, c.pending.length, room);
      const chunk = c.pending.subarray(0, n);
      c.pending = c.pending.subarray(n);
      const last = c.pending.length === 0;
      const flags = TCP_ACK | (last ? TCP_PSH : 0);
      this.sendSegment(c, flags, c.sndNxt, chunk);
      c.rtx.push({ seq: c.sndNxt, seqLen: n, flags, data: chunk });
      c.sndNxt = add(c.sndNxt, n);
      this.armTimerIfIdle(c);
    }
    if (c.pending.length === 0 && c.finQueued && !c.finSent) {
      c.finSent = true;
      c.finSeq = c.sndNxt;
      this.host.note(4, "I have nothing more to send, so I close my side: FIN+ACK.");
      this.sendSegment(c, TCP_FIN | TCP_ACK, c.sndNxt);
      c.rtx.push({ seq: c.sndNxt, seqLen: 1, flags: TCP_FIN | TCP_ACK, data: new Uint8Array(0) });
      c.sndNxt = add(c.sndNxt, 1);
      this.setState(c, c.state === "ESTABLISHED" ? "FIN_WAIT_1" : "LAST_ACK");
      this.armTimerIfIdle(c);
    }
  }

  private processAck(c: TcpConn, ack: number, window: number) {
    c.peerWindow = window;
    if (seqLt(c.sndUna, ack) && seqLe(ack, c.sndNxt)) {
      const acked = (ack - c.sndUna) >>> 0;
      c.sndUna = ack;
      c.rtx = c.rtx.filter((s) => seqLt(ack, add(s.seq, s.seqLen)));
      c.rto = INITIAL_RTO_US;
      c.retries = 0;
      if (c.rtx.length > 0) this.armTimer(c);
      else c.timerToken++;
      // Slow start: the congestion window grows by up to one MSS per ACK.
      if (c.cwnd < c.ssthresh) c.cwnd += Math.min(acked, c.mss);
      if (c.finSent && seqLe(add(c.finSeq, 1), ack)) this.finAcked(c);
    }
    this.pump(c);
  }

  private finAcked(c: TcpConn) {
    if (c.state === "FIN_WAIT_1") this.setState(c, "FIN_WAIT_2");
    else if (c.state === "CLOSING") this.enterTimeWait(c);
    else if (c.state === "LAST_ACK") {
      this.setState(c, "CLOSED");
      this.destroy(c);
    }
  }

  private enterTimeWait(c: TcpConn) {
    this.setState(c, "TIME_WAIT");
    this.host.note(
      4,
      "TIME_WAIT: the side that closed last keeps the connection record for 2 x MSL (60 s here) so a late duplicate FIN can still be acknowledged and old segments cannot confuse a new connection.",
    );
    this.net.later(TWO_MSL_US, () => {
      if (c.state === "TIME_WAIT") {
        this.setState(c, "CLOSED");
        this.destroy(c);
      }
    });
  }

  private sendAck(c: TcpConn) {
    c.unackedSegments = 0;
    c.delAckToken++;
    this.sendSegment(c, TCP_ACK, c.sndNxt);
  }

  private armDelayedAck(c: TcpConn) {
    const token = ++c.delAckToken;
    this.net.later(DELAYED_ACK_US, () => {
      if (token === c.delAckToken && c.unackedSegments > 0 && c.ackedUpTo !== c.rcvNxt) this.sendAck(c);
    });
  }

  private sendSegment(c: TcpConn, flags: number, seq: number, payload?: Bytes, mss?: number) {
    if (flags & TCP_ACK) c.ackedUpTo = c.rcvNxt;
    const segment = encodeTcp(c.localIp, c.remoteIp, {
      srcPort: c.localPort,
      dstPort: c.remotePort,
      seq,
      ack: flags & TCP_ACK ? c.rcvNxt : 0,
      flags,
      window: RECEIVE_WINDOW,
      mss,
      payload,
    });
    this.host.sendIp(c.remoteIp, IP_PROTO_TCP, segment, { dontFragment: true });
  }

  private sendReset(dstIp: string, seg: ParsedTcp) {
    const length = seg.payload.length + (seg.flags & TCP_SYN ? 1 : 0) + (seg.flags & TCP_FIN ? 1 : 0);
    const reply =
      seg.flags & TCP_ACK
        ? { seq: seg.ack, ack: 0, flags: TCP_RST }
        : { seq: 0, ack: add(seg.seq, length), flags: TCP_RST | TCP_ACK };
    const segment = encodeTcp(this.host.ip, dstIp, {
      srcPort: seg.dstPort,
      dstPort: seg.srcPort,
      window: 0,
      ...reply,
    });
    this.host.sendIp(dstIp, IP_PROTO_TCP, segment);
  }

  // ---- timers -------------------------------------------------------------------------

  private armTimerIfIdle(c: TcpConn) {
    if (c.rtx.length === 1) this.armTimer(c);
  }

  private armTimer(c: TcpConn) {
    const token = ++c.timerToken;
    this.net.later(c.rto, () => this.onTimeout(c, token));
  }

  private onTimeout(c: TcpConn, token: number) {
    if (token !== c.timerToken || c.rtx.length === 0 || c.state === "CLOSED") return;
    c.retries++;
    if (c.retries > MAX_RETRIES) {
      this.host.note(4, "Retransmission limit reached: TCP gives up and aborts the connection.");
      this.setState(c, "CLOSED");
      this.destroy(c);
      return;
    }
    const first = c.rtx[0] as Unacked;
    this.host.note(
      4,
      `Retransmission timeout (${(c.rto / 1000).toFixed(0)} ms) with no ACK: I assume the segment was lost and send it again, then double the timer. The congestion window drops back to 1 segment.`,
    );
    c.ssthresh = Math.max(2 * c.mss, Math.floor(((c.sndNxt - c.sndUna) >>> 0) / 2));
    c.cwnd = c.mss;
    c.rto = Math.min(c.rto * 2, 60_000_000);
    this.sendSegment(c, first.flags, first.seq, first.data, first.mss);
    this.armTimer(c);
  }

  // ---- bookkeeping --------------------------------------------------------------------

  private connKey(localPort: number, remoteIp: string, remotePort: number) {
    return `${localPort}|${remoteIp}:${remotePort}`;
  }

  private setState(c: TcpConn, state: TcpState) {
    c.state = state;
    this.host.state("tcp", "set", c.key, state);
  }

  private destroy(c: TcpConn) {
    c.timerToken++;
    c.delAckToken++;
    c.state = "CLOSED";
    this.host.state("tcp", "set", c.key, "CLOSED");
    this.host.state("tcp", "del", c.key, "");
    this.conns.delete(this.connKey(c.localPort, c.remoteIp, c.remotePort));
    c.handlers.onClosed?.(c);
  }
}

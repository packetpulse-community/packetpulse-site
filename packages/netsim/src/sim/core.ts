import type { Bytes } from "../bytes";

// ---- deterministic random numbers -------------------------------------------------

// mulberry32: tiny seeded PRNG. The same seed always produces the same run, which is
// what lets a trace be replayed, scrubbed and verified.
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  u32(): number {
    return Math.floor(this.next() * 4294967296) >>> 0;
  }
}

// ---- event scheduler (all times are integer microseconds of model time) --------------

interface Scheduled {
  t: number;
  seq: number;
  fn: () => void;
}

export class Scheduler {
  now = 0;
  private heap: Scheduled[] = [];
  private counter = 0;

  at(t: number, fn: () => void) {
    this.push({ t: Math.max(t, this.now), seq: this.counter++, fn });
  }

  after(delayUs: number, fn: () => void) {
    this.at(this.now + delayUs, fn);
  }

  // Runs queued events in time order (ties broken by insertion order) until the queue is
  // empty or the model clock would pass `limitUs`. Returns the time of the last event.
  run(limitUs: number): number {
    let last = 0;
    while (this.heap.length > 0) {
      const next = this.heap[0] as Scheduled;
      if (next.t > limitUs) break;
      this.pop();
      this.now = next.t;
      last = next.t;
      next.fn();
    }
    return last;
  }

  private less(a: Scheduled, b: Scheduled) {
    return a.t < b.t || (a.t === b.t && a.seq < b.seq);
  }

  private push(item: Scheduled) {
    const h = this.heap;
    h.push(item);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(h[i] as Scheduled, h[p] as Scheduled)) break;
      [h[i], h[p]] = [h[p] as Scheduled, h[i] as Scheduled];
      i = p;
    }
  }

  private pop() {
    const h = this.heap;
    const top = h[0] as Scheduled;
    const last = h.pop() as Scheduled;
    if (h.length > 0) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < h.length && this.less(h[l] as Scheduled, h[m] as Scheduled)) m = l;
        if (r < h.length && this.less(h[r] as Scheduled, h[m] as Scheduled)) m = r;
        if (m === i) break;
        [h[i], h[m]] = [h[m] as Scheduled, h[i] as Scheduled];
        i = m;
      }
    }
    return top;
  }
}

// ---- trace ----------------------------------------------------------------------------

export interface FrameEndpoint {
  device: string;
  iface: string;
}

// One frame crossing one link: the unit the interface animates and Wireshark would list.
export interface Frame {
  id: number;
  link: string;
  from: FrameEndpoint;
  to: FrameEndpoint;
  txAt: number; // when the sender started putting bits on the wire
  rxAt: number; // when the last bit reached the receiver
  bytes: Bytes;
  dropped?: string; // reason, when the frame never arrived
  cause?: number; // id of the frame whose arrival made the sender transmit this one
}

export type TableName = "arp" | "mac" | "tcp" | "dns" | "route";

export type TraceEvent =
  | { kind: "note"; t: number; device: string; layer: number | null; text: string; frame?: number }
  | { kind: "phase"; t: number; title: string; text: string; frame?: number }
  | { kind: "state"; t: number; device: string; table: TableName; op: "set" | "del"; key: string; value: string; frame?: number };

export class Recorder {
  frames: Frame[] = [];
  events: TraceEvent[] = [];
  private nextFrame = 1;

  newFrameId() {
    return this.nextFrame++;
  }
}

// ---- links, interfaces, devices -----------------------------------------------------

export interface LinkOptions {
  delayUs?: number; // propagation delay
  bps?: number; // bandwidth in bits per second
  lossPct?: number;
  mtu?: number;
}

export class Link {
  up = true;
  readonly delayUs: number;
  readonly bps: number;
  lossPct: number;
  readonly mtu: number;

  constructor(
    readonly id: string,
    readonly a: Iface,
    readonly b: Iface,
    opts: LinkOptions = {},
  ) {
    this.delayUs = opts.delayUs ?? 50;
    this.bps = opts.bps ?? 100_000_000;
    this.lossPct = opts.lossPct ?? 0;
    this.mtu = opts.mtu ?? 1500;
  }

  peerOf(iface: Iface): Iface {
    return iface === this.a ? this.b : this.a;
  }
}

export class Iface {
  link?: Link;
  txFreeAt = 0; // the transmitter is busy until this time (serialisation delay queue)

  constructor(
    readonly device: Device,
    readonly index: number,
    readonly name: string,
    readonly mac: string,
    public ip?: string,
    public prefix?: number,
  ) {}
}

export type DeviceKind = "host" | "switch" | "router";

export abstract class Device {
  readonly ifaces: Iface[] = [];

  constructor(
    readonly id: string,
    readonly name: string,
    readonly kind: DeviceKind,
    readonly net: Network,
  ) {}

  addIface(name: string, mac: string, ip?: string, prefix?: number): Iface {
    const iface = new Iface(this, this.ifaces.length, name, mac, ip, prefix);
    this.ifaces.push(iface);
    this.onIfaceAdded(iface);
    return iface;
  }

  protected onIfaceAdded(_iface: Iface): void {}

  abstract receive(iface: Iface, frame: Bytes): void;

  note(layer: number | null, text: string) {
    this.net.note(this.id, layer, text);
  }

  state(table: TableName, op: "set" | "del", key: string, value: string) {
    this.net.state(this.id, table, op, key, value);
  }
}

export class Network {
  readonly sched = new Scheduler();
  readonly rng: Rng;
  readonly rec = new Recorder();
  readonly devices = new Map<string, Device>();
  readonly links: Link[] = [];
  private cause: number | undefined;

  constructor(readonly seed: number) {
    this.rng = new Rng(seed);
  }

  now() {
    return this.sched.now;
  }

  add<T extends Device>(device: T): T {
    this.devices.set(device.id, device);
    return device;
  }

  connect(a: Iface, b: Iface, opts?: LinkOptions): Link {
    const link = new Link(`${a.device.id}.${a.name}--${b.device.id}.${b.name}`, a, b, opts);
    a.link = link;
    b.link = link;
    this.links.push(link);
    return link;
  }

  note(device: string, layer: number | null, text: string) {
    this.rec.events.push({ kind: "note", t: this.now(), device, layer, text, frame: this.cause });
  }

  phase(title: string, text: string) {
    this.rec.events.push({ kind: "phase", t: this.now(), title, text, frame: this.cause });
  }

  state(device: string, table: TableName, op: "set" | "del", key: string, value: string) {
    this.rec.events.push({ kind: "state", t: this.now(), device, table, op, key, value, frame: this.cause });
  }

  // While `fn` runs, frames sent and notes written are attributed to frame `id`.
  withCause<T>(id: number | undefined, fn: () => T): T {
    const prev = this.cause;
    this.cause = id;
    try {
      return fn();
    } finally {
      this.cause = prev;
    }
  }

  // Runs `fn` after a delay, keeping the current cause so the work is still attributed
  // to the frame that triggered it (used for switching latency, timers and so on).
  later(delayUs: number, fn: () => void) {
    const cause = this.cause;
    this.sched.after(delayUs, () => this.withCause(cause, fn));
  }

  get currentCause() {
    return this.cause;
  }

  // Puts a frame on the wire: waits for the transmitter, adds serialisation delay
  // (size / bandwidth) and propagation delay, rolls the link's loss dice, then schedules
  // the receive event on the device at the other end.
  transmit(from: Iface, bytes: Bytes): number | undefined {
    const link = from.link;
    if (!link) return undefined;
    const to = link.peerOf(from);
    const start = Math.max(this.now(), from.txFreeAt);
    const serialisation = Math.ceil((bytes.length * 8 * 1_000_000) / link.bps);
    from.txFreeAt = start + serialisation;
    const rxAt = start + serialisation + link.delayUs;

    const frame: Frame = {
      id: this.rec.newFrameId(),
      link: link.id,
      from: { device: from.device.id, iface: from.name },
      to: { device: to.device.id, iface: to.name },
      txAt: start,
      rxAt,
      bytes: Uint8Array.from(bytes),
      cause: this.cause,
    };
    this.rec.frames.push(frame);

    if (!link.up) frame.dropped = "link down";
    else if (link.lossPct > 0 && this.rng.next() * 100 < link.lossPct) frame.dropped = "lost on the wire";

    if (!frame.dropped) {
      this.sched.at(rxAt, () => {
        this.withCause(frame.id, () => to.device.receive(to, frame.bytes));
      });
    }
    return frame.id;
  }
}

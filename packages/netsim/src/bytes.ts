// Byte-level helpers shared by every codec. All multi-byte values are big-endian
// (network byte order), as in the RFCs.

export type Bytes = Uint8Array;

export class ByteWriter {
  private readonly buf: number[] = [];

  u8(v: number) {
    this.buf.push(v & 0xff);
    return this;
  }

  u16(v: number) {
    this.buf.push((v >>> 8) & 0xff, v & 0xff);
    return this;
  }

  u32(v: number) {
    this.buf.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
    return this;
  }

  bytes(b: ArrayLike<number>) {
    for (let i = 0; i < b.length; i++) this.buf.push((b[i] as number) & 0xff);
    return this;
  }

  get length() {
    return this.buf.length;
  }

  toBytes(): Bytes {
    return Uint8Array.from(this.buf);
  }
}

export function u8(b: ArrayLike<number>, o: number): number {
  return b[o] ?? 0;
}

export function u16(b: ArrayLike<number>, o: number): number {
  return ((b[o] ?? 0) << 8) | (b[o + 1] ?? 0);
}

export function u32(b: ArrayLike<number>, o: number): number {
  return (((b[o] ?? 0) << 24) | ((b[o + 1] ?? 0) << 16) | ((b[o + 2] ?? 0) << 8) | (b[o + 3] ?? 0)) >>> 0;
}

export function setU16(b: Uint8Array, o: number, v: number) {
  b[o] = (v >>> 8) & 0xff;
  b[o + 1] = v & 0xff;
}

export function concat(...parts: ArrayLike<number>[]): Bytes {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) out[o + i] = (p[i] as number) & 0xff;
    o += p.length;
  }
  return out;
}

export function ascii(s: string): Bytes {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

export function fromAscii(b: ArrayLike<number>, start = 0, end = b.length): string {
  let s = "";
  for (let i = start; i < end; i++) s += String.fromCharCode(b[i] ?? 0);
  return s;
}

export function hex(b: ArrayLike<number>, sep = " "): string {
  const out: string[] = [];
  for (let i = 0; i < b.length; i++) out.push(((b[i] ?? 0) & 0xff).toString(16).padStart(2, "0"));
  return out.join(sep);
}

export function hex16(v: number): string {
  return "0x" + (v & 0xffff).toString(16).padStart(4, "0");
}

export function hex32(v: number): string {
  return "0x" + (v >>> 0).toString(16).padStart(8, "0");
}

export function equalBytes(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ---- addresses --------------------------------------------------------------

export const BROADCAST_MAC = "ff:ff:ff:ff:ff:ff";

export function macToBytes(mac: string): number[] {
  const parts = mac.split(":");
  if (parts.length !== 6) throw new Error(`Invalid MAC address: ${mac}`);
  return parts.map((p) => parseInt(p, 16));
}

export function bytesToMac(b: ArrayLike<number>, o = 0): string {
  const out: string[] = [];
  for (let i = 0; i < 6; i++) out.push((b[o + i] ?? 0).toString(16).padStart(2, "0"));
  return out.join(":");
}

export function ipToBytes(ip: string): number[] {
  const parts = ip.split(".");
  if (parts.length !== 4) throw new Error(`Invalid IPv4 address: ${ip}`);
  return parts.map((p) => {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) throw new Error(`Invalid IPv4 address: ${ip}`);
    return n;
  });
}

export function bytesToIp(b: ArrayLike<number>, o = 0): string {
  return `${b[o] ?? 0}.${b[o + 1] ?? 0}.${b[o + 2] ?? 0}.${b[o + 3] ?? 0}`;
}

export function ipToInt(ip: string): number {
  const [a, b, c, d] = ipToBytes(ip) as [number, number, number, number];
  return (((a << 24) | (b << 16) | (c << 8) | d) >>> 0);
}

export function intToIp(n: number): string {
  return `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
}

export function prefixToMask(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

export function maskToDotted(prefix: number): string {
  return intToIp(prefixToMask(prefix));
}

export function networkOf(ip: string, prefix: number): number {
  return (ipToInt(ip) & prefixToMask(prefix)) >>> 0;
}

export function sameSubnet(a: string, b: string, prefix: number): boolean {
  return networkOf(a, prefix) === networkOf(b, prefix);
}

export function parseCidr(cidr: string): { network: number; prefix: number } {
  const [ip, p] = cidr.split("/");
  const prefix = Number(p);
  if (!ip || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) throw new Error(`Invalid CIDR: ${cidr}`);
  return { network: networkOf(ip, prefix), prefix };
}

import { concat, ipToBytes, u16 } from "./bytes";

// RFC 1071 Internet checksum: the one's complement of the one's complement sum of
// the data taken as 16-bit big-endian words (an odd final byte is padded with zero).
export function internetChecksum(data: ArrayLike<number>): number {
  return fold(sum16(data));
}

function sum16(data: ArrayLike<number>, initial = 0): number {
  let sum = initial;
  const n = data.length;
  for (let i = 0; i + 1 < n; i += 2) sum += ((data[i] as number) << 8) | (data[i + 1] as number);
  if (n & 1) sum += (data[n - 1] as number) << 8;
  return sum;
}

function fold(sum: number): number {
  let s = sum;
  while (s >>> 16) s = (s & 0xffff) + (s >>> 16);
  return ~s & 0xffff;
}

// TCP and UDP checksums cover a pseudo-header (RFC 793 / RFC 768): source address,
// destination address, a zero byte, the protocol number and the segment length,
// followed by the segment itself with its checksum field set to zero.
export function pseudoHeader(srcIp: string, dstIp: string, protocol: number, length: number): number[] {
  return [...ipToBytes(srcIp), ...ipToBytes(dstIp), 0, protocol, (length >>> 8) & 0xff, length & 0xff];
}

export function l4Checksum(srcIp: string, dstIp: string, protocol: number, segment: Uint8Array): number {
  return internetChecksum(concat(pseudoHeader(srcIp, dstIp, protocol, segment.length), segment));
}

// A received TCP segment, UDP datagram, ICMP message or IPv4 header is valid when the
// checksum computed over the data *including* its checksum field comes out as zero.
export function l4ChecksumValid(srcIp: string, dstIp: string, protocol: number, segment: Uint8Array): boolean {
  return internetChecksum(concat(pseudoHeader(srcIp, dstIp, protocol, segment.length), segment)) === 0;
}

export function readChecksumField(b: ArrayLike<number>, offset: number): number {
  return u16(b, offset);
}

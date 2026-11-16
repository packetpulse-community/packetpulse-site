import { describe, expect, it } from "vitest";
import { internetChecksum } from "../src/checksum";
import { encodeIpv4, encodeTcp, encodeUdp, encodeIcmpEcho, parseIpv4, TCP_ACK, TCP_SYN } from "../src/codecs";
import { hex } from "../src/bytes";

describe("internet checksum", () => {
  it("matches the worked example in RFC 1071 section 3", () => {
    // 00 01 f2 03 f4 f5 f6 f7 sums to 0xddf2, whose complement is 0x220d
    expect(internetChecksum([0x00, 0x01, 0xf2, 0x03, 0xf4, 0xf5, 0xf6, 0xf7])).toBe(0x220d);
  });

  it("pads an odd final byte with zero", () => {
    expect(internetChecksum([0x01])).toBe(~0x0100 & 0xffff);
  });

  it("verifies to zero when the checksum is included", () => {
    const header = encodeIpv4({ id: 0x1234, ttl: 64, protocol: 6, src: "10.0.0.1", dst: "10.0.0.2", payload: [] });
    expect(internetChecksum(header)).toBe(0);
  });

  it("reproduces the widely published IPv4 header example (checksum b861)", () => {
    const header = Uint8Array.from([0x45, 0x00, 0x00, 0x73, 0x00, 0x00, 0x40, 0x00, 0x40, 0x11, 0x00, 0x00, 0xc0, 0xa8, 0x00, 0x01, 0xc0, 0xa8, 0x00, 0xc7]);
    expect(internetChecksum(header)).toBe(0xb861);
  });
});

describe("codecs", () => {
  it("round-trips an IPv4 packet", () => {
    const bytes = encodeIpv4({ id: 7, dontFragment: true, ttl: 33, protocol: 17, src: "192.168.1.10", dst: "10.0.0.53", payload: [1, 2, 3] });
    const p = parseIpv4(bytes);
    expect(p).toMatchObject({ ttl: 33, protocol: 17, src: "192.168.1.10", dst: "10.0.0.53", id: 7, dontFragment: true, totalLength: 23 });
    expect(hex(p?.payload ?? [])).toBe("01 02 03");
  });

  it("builds TCP and UDP checksums that verify with a pseudo-header", () => {
    const syn = encodeTcp("1.1.1.1", "2.2.2.2", { srcPort: 1234, dstPort: 80, seq: 1, ack: 0, flags: TCP_SYN, window: 64240, mss: 1460 });
    const synAck = encodeTcp("2.2.2.2", "1.1.1.1", { srcPort: 80, dstPort: 1234, seq: 9, ack: 2, flags: TCP_SYN | TCP_ACK, window: 64240 });
    const udp = encodeUdp("1.1.1.1", "2.2.2.2", 5000, 53, [1, 2, 3, 4, 5]);
    expect(syn.length).toBe(24);
    expect(synAck.length).toBe(20);
    expect(udp.length).toBe(13);
    const icmp = encodeIcmpEcho(8, 1, 1, [9, 9, 9]);
    expect(internetChecksum(icmp)).toBe(0);
  });
});

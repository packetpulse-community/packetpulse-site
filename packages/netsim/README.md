# @packetpulse/netsim

A deterministic, byte-accurate network simulator and packet dissector. It powers **Packet Lab** (`/tools/packet-lab`) but has no browser or Node dependencies, so it runs anywhere.

## What it does

- Builds real frames: Ethernet II, ARP, IPv4, ICMP, UDP, TCP, DNS and HTTP, with checksums computed from the bytes.
- Simulates a small network (hosts, a learning switch, a router) as a discrete-event run in model time, with link delay, bandwidth, loss and a seeded random generator, so a run is reproducible.
- Records everything in an immutable **trace** (frames, narration notes, device-table changes).
- **Dissects** any frame into a tree of fields with byte offsets, plain-language notes and checksum verification.
- Exports a trace as a **`.pcap`** that Wireshark opens.

## Accuracy

Real: header layouts, field values, byte order, lengths, checksums, TTL handling, ARP, MAC learning, longest-prefix routing, TCP states, flags, sequence and acknowledgment arithmetic, MSS segmentation, slow start, delayed ACKs, retransmission, DNS name encoding.

Simplified: time is model time; congestion control stops at slow start; no window scaling or SACK; DNS is a single server; routing is static; no encryption.

## Tests

```bash
pnpm --filter @packetpulse/netsim test
```

`test/tshark.test.ts` exports each scenario to a `.pcap` and reads it with **tshark** (Wireshark's command-line dissector) with checksum verification on. It fails on any malformed packet or bad checksum. The suite is skipped, with a visible notice, when `tshark` is not installed (Debian and Ubuntu: `sudo apt-get install tshark`).

## Layout

| Path | Contents |
| --- | --- |
| `src/bytes.ts`, `checksum.ts`, `codecs.ts` | Primitives and protocol encoders |
| `src/dissect.ts` | Field-by-field dissection |
| `src/sim/` | Scheduler, links, devices, TCP stack, applications |
| `src/scenarios.ts` | The lab network and the scenarios; `runScenario` returns a trace |
| `src/analysis.ts` | Stream-relative numbers, capture points, display timeline |
| `src/pcap.ts` | libpcap export |

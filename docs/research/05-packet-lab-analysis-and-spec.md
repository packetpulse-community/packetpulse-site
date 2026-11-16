# 05. Packet Lab: Analysis and Specification

Part of the [research pack](00-index.md). Covers the three things requested: **(A)** OSI and TCP/IP model live visualisation, **(B)** full in-depth packet tracing, **(C)** a small but deep live networking simulation, all as "A to Z execution" with analysis. It sets out the design goals, grounds the design in what the PacketPulse repo already has ([Doc 04](04-existing-project-deep-analysis.md)), and ends with a phased build plan and the decisions needed.

## 0. Implementation status (22 Nov 2026, branch `feat/packet-lab`)

Phases 0 and 1 of section 9 are built and running; nothing is merged or released yet.

| Part | State | Evidence |
| --- | --- | --- |
| Engine `packages/netsim` | Built: byte and checksum primitives; Ethernet, ARP, IPv4, ICMP, UDP, TCP (full state machine, MSS, slow start, delayed ACK, retransmission), DNS, HTTP; hosts, learning switch, router with longest-prefix routing and TTL; seeded loss; trace; dissector with field offsets; stream-relative TCP numbers; display timeline; `.pcap` writer | 34 tests pass |
| Scenarios | E1 ping on the LAN, E2 ping across a router, E3 open a web page A to Z (DNS, ARP, TCP handshake, HTTP in three segments, teardown), each with an optional 20% lossy link | `packages/netsim/src/scenarios.ts` |
| Independent check | `tshark` 4.4.5 reads every scenario's capture (at several capture points): no malformed packets, every IP, TCP, UDP and ICMP checksum good, expert analysis clean on a normal run and reporting retransmissions on the lossy run. It also found one real bug in the TCP model (a redundant duplicate ACK), now fixed | `test/tshark.test.ts` |
| Interface | Public `/tools` hub and `/tools/packet-lab/[scenario]`: topology with moving packets, narration, packet list and sequence diagram, field tree and raw bytes with linked highlighting, OSI and TCP/IP panel, step-by-step encapsulation, per-device tables, play, step, scrub, speed, capture point, lossy-link toggle, `.pcap` download | Production build passes; pages are prerendered |
| Navigation | Tools added to the site navbar, app sidebar, command palette and footer | |

Not built yet: DHCP, traceroute, NAT, TLS, IPv6; the display-filter language; TCP stream graph; Watch, Explore and Challenge modes and predict-the-next-packet; quizzes linked to scenarios; progress tracking; reviewer sign-off metadata. A screen-reader pass and automated accessibility scan have not been run.

## 1. Design goals

The goal is a teaching tool that is honest about being a simulation and deep enough to trust. It is built from scratch, with its own name, visual language and code.

| Goal | What it means in practice |
| --- | --- |
| One story, three views | A topology diagram (where), a narrated explanation (why) and a packet list (what), all driven by one clock |
| Every packet can be opened | A header field tree with plain-language meanings, linked to the raw bytes |
| Layers are visible | The OSI and TCP/IP models side by side, with the layers used by the selected packet lit, and encapsulation shown step by step |
| Device state is visible | ARP caches, MAC tables, routing tables, TCP socket states and DNS caches as they were at that moment |
| Things can go wrong | Fault injection (a lossy link) shows TCP and DNS recovering |
| Verifiable | Every frame is a real, valid packet, exported as a `.pcap` that Wireshark opens, and checked in tests by `tshark` |
| Accessible | Everything shown in the animation is also available as tables and text; reduced motion is respected |

**Originality.** The name (Packet Lab), diagrams, layout, colours, copy and code are PacketPulse's own. Scenario text is written from the specifications, not copied from other tools.

## 2. Why this belongs in PacketPulse

| Link to the 2.0 plan | How Packet Lab serves it |
| --- | --- |
| Practice module is missing (Doc 02) | The simulator is the "written scenarios first" lab that Doc 1 s3.2 allows, without a runtime or per-user cost |
| Network Tools are fake (DEC-039, Doc 04 section 4) | Replace seeded-random output with a transparent, deterministic simulation that is labelled as one |
| Acquisition hypothesis (Doc 1 s4) | Public, indexable explainer pages are a content-led entry point for engineers |
| Prove loop (Learn, Practice, Prove) | Each scenario ends with a quiz in the existing quiz engine; a pass issues the existing certificate. Needs the quiz integrity fixes first (Doc 04 S-7, S-9) |
| Free-tier hosting (Render) | The simulation runs entirely in the browser, so it adds no backend load, no abuse surface (the old tools were disabled for that reason) and no cost |
| Trust principle | Every packet is generated from real header layouts with computed checksums, never hand-typed, so what a member sees matches what Wireshark would show |

## 3. Product definition

Three experiences on one engine, plus a content layer.

```
              ┌──────────────────────── Scenario (declarative) ─────────────────────────┐
              │ topology + devices + script (what the user does) + faults + questions   │
              └──────────────────────────────────┬──────────────────────────────────────┘
                                                 ▼
                         ┌───────────────────  netsim engine  ───────────────────┐
                         │ discrete-event simulation, real packet bytes           │
                         │ produces an immutable, replayable TRACE                │
                         └────────────┬───────────────────────────────┬───────────┘
                                      ▼                               ▼
    A. Model view (OSI / TCP-IP)   B. Packet tracer (Wireshark-style)   C. Live simulation (topology + devices)
    encapsulation stack animation  list, field tree, hex, sequence      play, step, inspect state, inject faults
```

All three read the same trace, so they can never disagree.

### 3.1 A. OSI and TCP/IP live visualisation

| Feature | Detail |
| --- | --- |
| Side-by-side models | OSI 7 layers beside TCP/IP 4 layers, with the mapping lines (OSI 5 to 7 to TCP/IP Application; 4 to Transport; 3 to Internet; 1 to 2 to Network Access). Click a layer to see its job, protocols, PDU name (data, segment, packet, frame, bits), devices that operate there |
| Live encapsulation | Pick any message in a trace. The sender's stack animates downward: application data, then a TCP header block is added, then IP, then Ethernet header and trailer, then bits on the wire. At the receiver the blocks peel off upward |
| Per-layer narration | What this layer decided and why: "TCP: split data to fit MSS 1460, assign sequence number 1"; "IP: next hop is not on my subnet, so use the default gateway"; "Ethernet: need the gateway's MAC, so ARP first" |
| Overhead view | Bytes by layer (for example 14 Ethernet, 20 IP, 20 TCP, N payload, 4 FCS) as a stacked bar, so "why a 1-byte message is 55 bytes on the wire" is visible |
| Layer filter | Show only events at chosen layers; click a packet to highlight the layer stack it used |
| Compare mode | Same message at the sender and receiver, to show decapsulation is the mirror |

### 3.2 B. Full in-depth packet tracing

| Feature | Detail |
| --- | --- |
| Packet list | No., time, source, destination, protocol, length, info; colour rules; filter box with a small display-filter language (`ip.addr == 10.0.0.5 && tcp.flags.syn`); follow-stream view |
| Field tree | Every header decoded to named fields with value, meaning, and offset: for example `Time to Live: 63 (decremented from 64 by the router)` |
| Hex and ASCII | Linked highlighting both ways: click a field, bytes light up; click bytes, the field opens. Offsets and byte counts shown |
| Computed values | Checksums recomputed live and shown as `correct` or `incorrect`; relative and absolute sequence numbers; lengths cross-checked |
| Sequence diagram | Lanes per device, arrows with time and short labels, retransmissions and drops marked |
| Stream analysis | TCP stream graph: sequence over time, window, retransmissions; RTT per handshake |
| Annotations | "Why this packet exists" and a link to the relevant RFC section (title and number only; text paraphrased, not copied) |
| Export | Download `.pcap` for Wireshark. This is also the verification oracle (section 7.2) |

### 3.3 C. Small, deep live simulation

The network is deliberately small so that every device can be fully inspected.

```
 192.168.1.0/24 (LAN)                                         203.0.113.0/24   198.51.100.0/24
 ┌────────┐        ┌────────┐        ┌──────────────┐          ┌───────────┐   ┌───────────┐
 │ PC-A   ├────────┤ Switch ├────────┤  Router R1   ├──────────┤ Web server│   │ DNS server│
 │ .1.10  │        │ 8-port │        │ .1.1 | .0.1  │ WAN      │ .0.10     │   │ .51.53    │
 └────────┘        └───┬────┘        └──────────────┘ (cloud)  └───────────┘   └───────────┘
 ┌────────┐            │
 │ PC-B   ├────────────┘     PC-B .1.20 (a second host for same-LAN scenarios)
 └────────┘
```

| Capability | Detail |
| --- | --- |
| Devices | Host (PC, server), L2 switch with MAC learning, router with routing table and optional NAT, simple "internet cloud" as a router chain |
| Link model | Per link: propagation delay, bandwidth (serialisation delay by frame size), loss percent, MTU. Seeded random so a run is reproducible |
| Protocols executed | Ethernet II, ARP, IPv4, ICMP, UDP, TCP (full state machine, MSS, retransmission, simple slow start), DNS (stub plus recursive to authoritative), DHCP (DORA), HTTP/1.1; later TLS 1.3 shape and IPv6 with NDP |
| Inspectors | Per device, live: ARP cache, MAC table, routing table with matched route highlighted, interface counters, TCP socket states, DNS cache, NAT table |
| Controls | Play, pause, step one event, step one packet, step to next layer boundary, speed, scrub timeline, reset, seed |
| Fault injection | Cut a link, set loss percent, set MTU, wrong gateway, wrong mask, missing route, DNS wrong answer, block with ACL, duplicate IP |
| Script panel | The user "types" what a real person would: `ping 192.168.1.20`, `nslookup example.com`, `curl http://example.com`, `traceroute`. Each command is a script the engine executes end to end |
| Predict mode | Before the next step, ask "What will the next packet be: ARP request, DNS query, or TCP SYN?" and reveal the answer with reasons |

### 3.4 The A-to-Z walkthrough ("open a web page")

This is the hero scenario; every other scenario is a subset of it. Numbers are events in the trace, approximate.

| Phase | What happens | Layers exercised |
| --- | --- | --- |
| 0 | User runs `curl http://www.example.com/` on PC-A | 7 |
| 1 | Resolver checks its cache, misses | 7 |
| 2 | PC-A needs the DNS server (off-subnet) so it needs the gateway MAC: **ARP request** (broadcast) and **ARP reply** (unicast) | 2 |
| 3 | **DNS query** (UDP 53) is framed, switched (MAC learned), routed (TTL 64 to 63, new Ethernet header), reaches the DNS server; **response** returns; cache stored | 7, 4, 3, 2, 1 |
| 4 | **TCP three-way handshake** to the web server: SYN (MSS and window options), SYN-ACK, ACK. States move CLOSED, SYN-SENT, ESTABLISHED | 4 |
| 5 | **HTTP GET** in a TCP segment, ACKed. The router rewrites L2 headers at each hop | 7, 4 |
| 6 | **HTTP 200** with a body larger than one MSS: segmentation into several TCP segments, cumulative ACKs, window updates | 7, 4 |
| 7 | **FIN, ACK, FIN, ACK** teardown with TIME-WAIT | 4 |
| 8 | Rendering step: the browser parses and stops; summary screen with byte counts per layer, total time, RTT breakdown (DNS vs TCP vs HTTP) | summary |

A clean run has roughly 25 to 35 frames across 6 to 10 devices' worth of events. Every one can be opened to the byte.

## 4. Engine design

### 4.1 Package and placement

| Piece | Location | Why |
| --- | --- | --- |
| `@packetpulse/netsim` | new `packages/netsim` | Pure TypeScript with no DOM. Matches the existing `packages/types` pattern; runs in the browser and in Node tests; the same code can later render pcaps server-side |
| Packet Lab UI | `apps/web/src/features/packet-lab` | Follows the existing `features/<domain>/{api,components}` layout |
| Routes | `/tools` (a hub listing the tools), `/tools/packet-lab`, `/tools/packet-lab/[scenario]` | Public. Progress and quiz completion call the existing API only for signed-in members |
| Scenario content | `packages/netsim/src/scenarios/*.ts` | Version-controlled and reviewed by pull request, which meets DEC-019 (people decide); can move to the admin database later |

### 4.2 Core modules

| Module | Responsibility | Notes |
| --- | --- | --- |
| `bytes` | Growable byte builder, big-endian readers and writers, hex helpers | |
| `checksum` | RFC 1071 Internet checksum, pseudo-header handling for TCP and UDP | The most error-prone part, and fully testable |
| `codecs/*` | For each protocol: `encode(fields) to bytes` and `decode(bytes) to FieldTree` | Ethernet II, ARP, IPv4, ICMP, UDP, TCP with options, DNS (name compression), DHCP, HTTP/1.1 (text), TLS records (shape) |
| `FieldTree` | Tree of `{name, label, value, offset, length, description, rfc, children}` | One data structure feeds the field tree, hex highlighting and the display filter |
| `sim/clock` | Event priority queue ordered by time then insertion sequence | Deterministic |
| `sim/node` | Host, Switch, Router; each with interfaces, tables and a protocol stack | |
| `sim/link` | Delay, bandwidth, loss, MTU, up or down | Seeded PRNG (the repo already uses mulberry32 in `network-tools.service.ts`) |
| `stack/*` | ARP, IPv4 forwarding and fragmentation decision, ICMP, UDP sockets, TCP state machine, DNS resolver and server, DHCP client and server, HTTP client and server | TCP follows the RFC 9293 state diagram |
| `trace` | Append-only list of events: `{t, node, layer, kind (tx, rx, forward, drop, encap, decap, timer, state), packetId, bytes?, note}` | Immutable once produced |
| `pcap` | Writes libpcap files from the trace | Enables verification and "open in Wireshark" |
| `filter` | Parser and evaluator for a display-filter subset over `FieldTree` | |

### 4.3 Run model: compute once, replay anywhere

The engine runs the whole scenario to completion into a trace (milliseconds for a few hundred events). The UI then **replays** the trace on a clock. This gives:

- exact reproducibility (same seed, same trace);
- free scrubbing and rewind, with no need to simulate backwards;
- trivial testing: assert on the trace;
- no worker needed at this size.

User actions that change the world (inject a fault, type a new command) produce a new trace from the start with the new inputs, then the UI jumps to the same time.

### 4.4 Fidelity statement (shown to learners)

| Real, per the RFCs | Simplified or illustrative |
| --- | --- |
| Header layouts, field values, byte order, lengths, checksums, TTL handling, ARP and MAC learning, longest-prefix match, TCP states and flags, sequence and ACK arithmetic, DNS name encoding | Timing is model time, not wall time; congestion control is slow start with a fixed timeout, not a full stack; TLS shows record structure and message sizes but no real cryptography; routing is static; the "internet" is a few routers |

A visible "This is a simulation" banner plus this table on an "About the accuracy" panel keeps the product honest, in line with Doc 2 DES-003.

## 5. Interface design

### 5.1 Layout

Desktop (three regions plus drawer):

```
┌ Header: scenario menu · search · mode (Watch / Explore / Challenge) · theme · help ──────────────┐
├ Left: Topology + devices ─────────────┬ Right: Layer stack (A) / Narration ────────────────────────┤
│  SVG diagram, packets move on links   │ OSI | TCP/IP columns, headers stack as bubbles, "why" text   │
│  click a device to open its inspector │ overhead bar                                                  │
├ Bottom: Packet list (B) ──────────────┴───────────────────────────────────────────────────────────┤
│ No · Time · Src · Dst · Proto · Len · Info        [filter box]       Player: ◀ ▶ ⏸ ⏭  1×  ──●────── │
├ Drawer: Packet detail ─ Field tree │ Hex + ASCII │ Sequence │ TCP stream │ Device inspector ───────┤
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Phone: one panel at a time, tab bar (Topology, Stack, Packets, Detail, Devices), player pinned at the bottom, stepping is the default rather than autoplay.

### 5.2 Visual language

- Use the PacketPulse tokens (Doc 2): Signal Grove neutrals and a module accent for Learning (indigo). The canvas may use the dark surface even in the light theme, as a code editor does, if the owner approves.
- Protocol chips: ARP, ICMP, UDP, DNS, TCP, HTTP, TLS each get a colour plus a text label and glyph (never colour alone, DEC-007).
- Monospace (JetBrains Mono) for bytes, addresses, flags; Inter for narration.
- Motion: packets travel along links with duration proportional to modelled latency but capped; with `prefers-reduced-motion` the diagram does not animate and the player steps instead.

### 5.3 Accessibility requirements (WCAG 2.2 AA)

| Need | How |
| --- | --- |
| Animation is not the only channel | Every event also appears as a row in the packet list and a line in a live-region narration (polite) |
| Keyboard | Space plays or pauses, Left and Right step, Shift plus arrows step by layer, `/` focuses the filter, Enter opens a packet; focus ring always visible |
| Screen reader | Packet list is a real table; field tree is an ARIA tree; hex view exposes the byte range of the focused field as text ("bytes 14 to 33, IPv4 header") |
| Colour | Status by text and glyph as well as colour; protocol chips carry labels |
| Reflow | Works at 320 px; hex view scrolls inside its own region, not the page |
| Motion | Reduced-motion mode removes travel animation, keeps highlights |

## 6. Content design (teaching, not just displaying)

### 6.1 Three modes

| Mode | Behaviour | For |
| --- | --- | --- |
| Watch | Scripted narration, auto-advance at a gentle pace, key moments pause with a one-sentence "why" | First-time learners |
| Explore | Free stepping, any inspector, any filter, fault toggles | Self-directed study |
| Challenge | Predict the next packet, find the fault, fix the config, with hints and a score | Practice |

### 6.2 Scenario catalogue

| ID | Scenario | Teaches | Phase |
| --- | --- | --- | --- |
| E1 | Ping a host on the same LAN | ARP, ICMP echo, switch MAC learning and flooding | 1 |
| E2 | Ping across the router | Default gateway, TTL, routing lookup, L2 header rewrite | 1 |
| E3 | **Open a web page, A to Z** | DNS, ARP, TCP handshake, HTTP, segmentation, teardown | 1 |
| E4 | DHCP: how a host gets an address | Broadcast, DORA, lease | 2 |
| E5 | Traceroute | TTL, ICMP time exceeded, per-hop RTT | 2 |
| E6 | Packet loss and retransmission | RTO, duplicate ACK, fast retransmit | 2 |
| E7 | NAT and PAT | Address translation table, port mapping | 3 |
| E8 | HTTPS and the TLS handshake | Record layer, handshake flights, why payload is opaque | 3 |
| E9 | IPv6 and NDP | Neighbour discovery replacing ARP | 3 |
| F1 | Fault: wrong default gateway | "Destination unreachable" diagnosis | 2 |
| F2 | Fault: missing route | Silent drop versus ICMP unreachable | 2 |
| F3 | Fault: DNS returns the wrong address | Separating name from connectivity problems | 2 |
| F4 | Fault: MTU and the DF bit | Fragmentation versus "needs fragmentation" | 3 |
| F5 | Fault: ACL blocks TCP 80 | Why ping works but the page does not | 3 |
| F6 | Fault: duplicate IP | ARP conflict | 3 |

Each scenario ships with: a short brief, the script, expected observations, 5 to 8 quiz questions (reusing the existing quiz model and category, for example `CCNA` or `Network Automation`), and reviewer sign-off metadata (who checked it against which RFC sections, and when).

### 6.3 Link to the proof loop

Completing a scenario unlocks its quiz; a passing quiz issues the existing certificate. The quiz integrity items in Doc 04 (attempt cap, timer enforcement, certificate preservation) are prerequisites for presenting this as "verified".

## 7. Quality and verification (the correctness plan)

A wrong packet would teach the wrong thing, so correctness is the main risk and the engine is built to be checkable.

### 7.1 Test layers

| Layer | Method |
| --- | --- |
| Primitives | Known-answer tests for the Internet checksum (examples given in the RFCs) and byte helpers |
| Codecs | Round trip (`decode(encode(x)) == x`) plus property tests; decode of fixed byte vectors taken from reputable captures, not hand-typed from memory |
| State machines | Transition tables from RFC 9293 (TCP), ARP and DHCP message flows; illegal transitions rejected |
| Scenarios | Golden traces: assert the exact ordered list of packets for each scenario and seed |
| Invariants | Run property checks over every trace: lengths consistent, checksums valid, TTL never increases, ARP precedes first unicast to an unknown IP, every TCP segment is ACKed or retransmitted |

### 7.2 External oracle: tshark

`tshark` and `tcpdump` are installed on this development machine. Every scenario's trace is exported to `.pcap` and read back with `tshark -r file.pcap -V` plus expert-info checks. The test fails if tshark reports a malformed packet or a bad checksum, or if its field values differ from the engine's decode. This gives an independent dissector verifying the engine, which is stronger than testing the engine against itself. In CI the step runs only if `tshark` is available and is otherwise skipped with a clear notice.

### 7.3 Human review

Every scenario carries a named reviewer and the RFC sections consulted. Narration text is paraphrased from the specifications, never pasted. AI drafts narration and scenario scripts; a person with networking knowledge approves them before publishing (DEC-019).

## 8. Fit with the existing code

| Existing item | Action |
| --- | --- |
| `apps/backend/.../network-tools` and `/network-tools` | Keep until Packet Lab E3 ships, then retire the backend module and redirect the route; the dashboard shortcuts point to Packet Lab scenarios |
| Dashboard "Network Snapshot" (simulated) | Remove; replace with "Continue your last scenario" |
| `Quiz`, `Certificate`, `Category` | Reuse. Add an optional `scenarioId` on quizzes (small migration) so a quiz can be linked from a scenario |
| `Notification` | Optional "You completed E3" message later |
| Command palette | Add Explore entries |
| Design primitives | Reuse `Card`, `Badge`, `Dialog` (after the accessible dialog fix, Doc 03 UX-02) |
| Tailwind and tokens | Build Packet Lab on semantic tokens so the Signal Grove migration does not redo it |
| Dependencies | None required beyond React; optional `@tanstack/react-virtual` for long packet lists |
| Backend | No changes for the simulator; only the quiz link and progress calls |

## 9. Delivery plan (relative sizes; re-estimate after Phase 0)

| Phase | Goal | Deliverables | Exit criteria | Size |
| --- | --- | --- | --- | --- |
| 0 Spike | Prove the loop end to end with the smallest real thing | `packages/netsim` with bytes, checksum, Ethernet, ARP, IPv4, ICMP codecs; event loop; two hosts and a switch; E1 "ping on the LAN"; trace; minimal list and hex view; pcap export | tshark reads the pcap with no errors; golden trace test passes; works in the browser | M |
| 1 Core | The A-to-Z web page scenario with full depth | UDP, DNS, TCP state machine and options, HTTP; router with TTL and routing table; E2 and E3; field tree with linked hex; topology and sequence views; device inspectors; player with scrub | E3 trace verified by tshark; all codec and state tests green; keyboard and reduced-motion paths work | L |
| 2 Teach | Make it a learning product | Model view (OSI and TCP/IP encapsulation animation), narration, Watch, Explore and Challenge modes, predict-next-packet, scenarios E4 to E6, F1 to F3, filter language, TCP stream graph, quizzes linked to certificates | Learner test (6 to 8 people) completes E3 and can explain each layer; accessibility pass with a screen reader | L |
| 3 Breadth | More protocols and faults | NAT, TLS shape, IPv6 and NDP, MTU, ACL, duplicate IP; E7 to E9, F4 to F6; progress tracking; admin review metadata | Each scenario reviewed and signed off; public pages indexable | M to L |
| 4 Hardening | Production quality | Performance profile on a mid-range phone, bundle budget, analytics events (no personal data), content review process, docs | Lighthouse and accessibility budgets met; retire network-tools | M |

Suggested team use of the Fable model: it is well suited to the spec-driven parts (codecs, state machines, scenario scripts) when each is given an RFC section, fixed byte vectors and a failing test as the target; the tshark oracle and golden traces give it an objective pass or fail, which is how to keep generated protocol code correct.

## 10. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Protocol errors teach the wrong thing | High | Section 7: external oracle, golden traces, named reviewers |
| Scope creep (every protocol, full Wireshark) | High | Phase gates; E1 to E3 first; a short "not planned" list (BGP, OSPF, wireless, real crypto) |
| Complex UI is hard on phones | Medium | One-panel mobile layout; stepping default; usability test on phones in Phase 2 |
| Accessibility of an animation-heavy tool | Medium | Section 5.3; trace table is the primary channel |
| Looks like "fake" tools again | Medium | Explicit simulation banner and fidelity statement; verified pcap export |
| Visual identity clash with the current dark glass look | Low | Tokens first; owner decision on the canvas theme |
| Free-tier hosting | Low | Client-side only; no backend load |
| Trademark and copy concerns (Wireshark-like look, Cisco-style icons) | Low | Own icon set; generic device shapes; no vendor assets |

## 11. Decisions needed

| ID | Decision | Recommendation |
| --- | --- | --- |
| DEC-040 | Run the simulation entirely in the browser | Yes |
| DEC-041 | Place it under a public Tools section (`/tools`) with signed-in progress | Yes |
| DEC-042 | Retire the fake Network Tools once E3 ships | Yes (DEC-039 resolved) |
| DEC-043 | Canvas theme: follow the app theme, or always dark | Follow the app theme with a dark option |
| DEC-044 | Scenario content ownership and review | Repository content, one named reviewer per scenario |
| DEC-045 | Scope of the first release | Phases 0 and 1 (E1 to E3) before anything else |

## 12. Not verified

The real size and speed of traces on low-end phones; whether the chosen tshark version is present in CI; learner reactions (no study yet; the Doc 03 plan, studies A and E, should include this tool); and legal review of any text taken from standards (the plan is to paraphrase).

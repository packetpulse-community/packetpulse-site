"use client";

import type { Dissection, DeviceInfo, Trace } from "@packetpulse/netsim";
import { CANVAS, LAB_LAYOUT } from "../lib/layout";
import { packetBadge, protocolColor } from "../lib/format";

interface Hop {
  start: number;
  end: number;
}

interface Props {
  trace: Trace;
  dissected: Map<number, Dissection>;
  hops: Map<number, Hop>;
  time: number;
  hopMs: number;
  selectedFrame: number | null;
  activeDevice: string | null;
  inspectDevice: string | null;
  onSelectDevice: (id: string) => void;
}

function Glyph({ device, active, selected }: { device: DeviceInfo; active: boolean; selected: boolean }) {
  const stroke = selected ? "var(--grove-focus)" : active ? "var(--grove-brand-text)" : "var(--grove-control)";
  const common = { fill: "var(--grove-surface)", stroke, strokeWidth: active || selected ? 3 : 2 } as const;
  if (device.kind === "host") {
    return (
      <g>
        <rect x={-28} y={-22} width={56} height={36} rx={5} {...common} />
        <rect x={-22} y={-16} width={44} height={24} rx={2} fill="var(--grove-subtle)" />
        <path d="M-12 22 H12 M0 14 V22" stroke={stroke} strokeWidth={3} strokeLinecap="round" />
      </g>
    );
  }
  if (device.kind === "switch") {
    return (
      <g>
        <rect x={-38} y={-15} width={76} height={30} rx={6} {...common} />
        {[-24, -8, 8, 24].map((x) => (
          <rect key={x} x={x - 4} y={-6} width={8} height={10} rx={1.5} fill="var(--grove-subtle)" stroke="var(--grove-control)" />
        ))}
      </g>
    );
  }
  return (
    <g>
      <circle r={27} {...common} />
      <path d="M-14 0 H14 M-14 0 l5 -5 M-14 0 l5 5 M14 0 l-5 -5 M14 0 l-5 5 M0 -14 V14 M0 -14 l-5 5 M0 -14 l5 5 M0 14 l-5 -5 M0 14 l5 -5" stroke={stroke} strokeWidth={2} fill="none" strokeLinecap="round" />
    </g>
  );
}

export function TopologyView({ trace, dissected, hops, time, hopMs, selectedFrame, activeDevice, inspectDevice, onSelectDevice }: Props) {
  const pos = (id: string) => LAB_LAYOUT[id] ?? { x: 0, y: 0 };

  const inFlight = trace.frames.filter((f) => {
    const h = hops.get(f.id);
    return h && time >= h.start && time < h.end + 250;
  });
  const selected = selectedFrame !== null ? trace.frames.find((f) => f.id === selectedFrame) : undefined;
  const selectedInFlight = selected ? inFlight.some((f) => f.id === selected.id) : false;

  return (
    <div className="overflow-x-auto" role="region" aria-label="Network diagram (scrolls sideways on narrow screens)" tabIndex={0}>
    <svg
      viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
      className="h-auto w-full min-w-[640px]"
      role="group"
      aria-label="Network diagram. PC-A and PC-B connect through switch SW1 to router R1; R1 connects through switch SW2 to the web server and the DNS server."
    >
      {/* broadcast domains */}
      <rect x={28} y={56} width={410} height={410} rx={18} style={{ fill: "var(--pl-ip-soft)" }} stroke="var(--grove-control)" strokeDasharray="6 6" />
      <text x={44} y={84} fill="var(--grove-text-secondary)" fontSize={14}>LAN 192.168.1.0/24 · one broadcast domain</text>
      <rect x={585} y={56} width={390} height={410} rx={18} style={{ fill: "var(--pl-tcp-soft)" }} stroke="var(--grove-control)" strokeDasharray="6 6" />
      <text x={601} y={84} fill="var(--grove-text-secondary)" fontSize={14}>Servers 10.0.0.0/24 · another broadcast domain</text>

      {/* links */}
      {trace.links.map((l) => {
        const a = pos(l.a.device);
        const b = pos(l.b.device);
        const lossy = l.lossPct > 0;
        return (
          <g key={l.id}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={lossy ? "var(--state-danger)" : "var(--grove-control)"} strokeWidth={4} strokeDasharray={lossy ? "8 6" : undefined} strokeLinecap="round" />
            {lossy && (
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 + 36} fill="var(--state-danger)" fontSize={13} textAnchor="middle">
                {l.lossPct}% of frames lost here
              </text>
            )}
          </g>
        );
      })}

      {/* selected frame marker (visible even when stepping, when nothing is moving) */}
      {selected && !selectedInFlight && (() => {
        const a = pos(selected.from.device);
        const b = pos(selected.to.device);
        const d = dissected.get(selected.id);
        const color = protocolColor(d?.protocol ?? "");
        const x = (a.x + b.x) / 2;
        const y = (a.y + b.y) / 2;
        return (
          <g>
            <circle cx={x} cy={y} r={13} fill="none" stroke={color} strokeWidth={2} strokeDasharray="3 3" />
            <text x={x} y={y - 20} textAnchor="middle" fontSize={13} fill={color} fontWeight={600} stroke="var(--grove-surface)" strokeWidth={3} paintOrder="stroke">{d ? packetBadge(d) : ""}</text>
          </g>
        );
      })()}

      {/* moving packets */}
      {inFlight.map((f) => {
        const h = hops.get(f.id) as Hop;
        const raw = (time - h.start) / hopMs;
        const p = Math.min(1, Math.max(0, raw));
        const a = pos(f.from.device);
        const b = pos(f.to.device);
        const x = a.x + (b.x - a.x) * p;
        const y = a.y + (b.y - a.y) * p;
        const d = dissected.get(f.id);
        const color = protocolColor(d?.protocol ?? "");
        const gone = !!f.dropped && p > 0.55;
        const fade = raw > 1 ? Math.max(0, 1 - (raw - 1) * hopMs / 250) : 1;
        return (
          <g key={f.id} opacity={gone ? 0.25 : fade}>
            <circle cx={x} cy={y} r={11} fill={color} stroke="var(--grove-surface)" strokeWidth={2} />
            {f.id === selectedFrame && <circle cx={x} cy={y} r={17} fill="none" stroke={color} strokeWidth={2} />}
            <text x={x} y={y - 20} textAnchor="middle" fontSize={13} fill={color} fontWeight={700} stroke="var(--grove-surface)" strokeWidth={3} paintOrder="stroke">
              {d ? packetBadge(d) : ""}
            </text>
            {gone && (
              <text x={x} y={y + 5} textAnchor="middle" fontSize={18} fill="var(--grove-surface)" fontWeight={800}>×</text>
            )}
          </g>
        );
      })}

      {/* devices */}
      {trace.devices.map((d) => {
        const { x, y } = pos(d.id);
        const active = activeDevice === d.id;
        const selectedDev = inspectDevice === d.id;
        const ips = d.ifaces.filter((i) => i.ip).map((i) => i.ip as string);
        return (
          <g
            key={d.id}
            transform={`translate(${x} ${y})`}
            role="button"
            tabIndex={0}
            aria-label={`Inspect ${d.name}`}
            aria-pressed={selectedDev}
            className="cursor-pointer outline-none [&:focus-visible_.focus-ring]:opacity-100"
            onClick={() => onSelectDevice(d.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectDevice(d.id);
              }
            }}
          >
            <rect className="focus-ring opacity-0" x={-52} y={-40} width={104} height={104} rx={14} fill="none" stroke="var(--grove-focus)" strokeWidth={2} />
            <Glyph device={d} active={active} selected={selectedDev} />
            <text y={46} textAnchor="middle" fontSize={15} fontWeight={600} fill="var(--grove-text)">{d.name}</text>
            {ips.map((ip, i) => (
              <text key={ip} y={63 + i * 15} textAnchor="middle" fontSize={12} fill="var(--grove-text-secondary)" className="font-mono">{ip}</text>
            ))}
          </g>
        );
      })}
    </svg>
    </div>
  );
}

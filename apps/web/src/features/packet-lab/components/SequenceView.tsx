"use client";

import type { Dissection, Trace } from "@packetpulse/netsim";
import { packetBadge, protocolColor } from "../lib/format";

interface Props {
  trace: Trace;
  dissected: Map<number, Dissection>;
  hops: Map<number, { start: number; end: number }>;
  time: number;
  selectedFrame: number | null;
  onSelect: (frameId: number) => void;
}

const ORDER = ["pc-a", "pc-b", "sw1", "r1", "sw2", "web", "dns"];
const ROW = 28;
const TOP = 56;
const LEFT = 20;
const WIDTH = 940;

export function SequenceView({ trace, dissected, hops, time, selectedFrame, onSelect }: Props) {
  const lanes = ORDER.filter((id) => trace.devices.some((d) => d.id === id));
  const x = (id: string) => LEFT + (lanes.indexOf(id) + 0.5) * (WIDTH / lanes.length);
  const frames = trace.frames
    .filter((f) => (hops.get(f.id)?.start ?? Infinity) <= time)
    .sort((a, b) => (hops.get(a.id)?.start ?? 0) - (hops.get(b.id)?.start ?? 0));
  const height = TOP + Math.max(frames.length, 1) * ROW + 20;

  return (
    <div className="max-h-72 overflow-auto rounded-md border border-border bg-surface-subtle" role="region" aria-label="Sequence diagram of every frame on every link" tabIndex={0}>
      <svg viewBox={`0 0 ${WIDTH + LEFT * 2} ${height}`} className="min-w-[760px]" role="img" aria-label={`Sequence diagram with ${frames.length} frames so far. The same information is in the packet list.`}>
        {lanes.map((id) => (
          <g key={id}>
            <text x={x(id)} y={22} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--grove-text)">{trace.devices.find((d) => d.id === id)?.name}</text>
            <line x1={x(id)} y1={32} x2={x(id)} y2={height - 6} stroke="var(--grove-control)" strokeWidth={2} strokeDasharray="4 4" />
          </g>
        ))}
        {frames.map((f, i) => {
          const d = dissected.get(f.id);
          const y = TOP + i * ROW;
          const x1 = x(f.from.device);
          const x2 = x(f.to.device);
          const color = protocolColor(d?.protocol ?? "");
          const dir = x2 > x1 ? 1 : -1;
          const sel = f.id === selectedFrame;
          return (
            <g key={f.id} onClick={() => onSelect(f.id)} className="cursor-pointer" opacity={f.dropped ? 0.55 : 1}>
              {sel && <rect x={LEFT} y={y - 14} width={WIDTH} height={ROW - 2} style={{ fill: "var(--grove-brand)", fillOpacity: 0.18 }} />}
              <line x1={x1} y1={y} x2={x2 - dir * 6} y2={y} stroke={color} strokeWidth={2.5} strokeDasharray={f.dropped ? "5 4" : undefined} />
              <path d={`M${x2} ${y} l${-dir * 8} -5 v10 z`} fill={color} />
              <text x={(x1 + x2) / 2} y={y - 5} textAnchor="middle" fontSize={11} fill="var(--grove-text)" stroke="var(--grove-subtle)" strokeWidth={3} paintOrder="stroke">
                {d ? `${packetBadge(d)}${f.dropped ? " ×" : ""}` : ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

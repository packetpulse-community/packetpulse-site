"use client";

import { useEffect, useRef } from "react";
import type { CapturedPacket, Dissection, Trace } from "@packetpulse/netsim";
import { cn } from "@/shared/utils/cn";
import { formatSeconds, protocolColor } from "../lib/format";

interface Props {
  trace: Trace;
  rows: CapturedPacket[];
  dissected: Map<number, Dissection>;
  selectedFrame: number | null;
  followLatest: boolean;
  showHop: boolean;
  onSelect: (frameId: number) => void;
}

const deviceName = (trace: Trace, id: string) => trace.devices.find((d) => d.id === id)?.name ?? id;

export function PacketTable({ trace, rows, dissected, selectedFrame, followLatest, showHop, onSelect }: Props) {
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const first = rows[0]?.time ?? 0;

  useEffect(() => {
    if (!followLatest) return;
    const last = bodyRef.current?.lastElementChild as HTMLElement | null | undefined;
    last?.scrollIntoView({ block: "nearest" });
  }, [rows.length, followLatest]);

  function move(delta: number) {
    const i = rows.findIndex((r) => r.frame.id === selectedFrame);
    const next = rows[Math.min(rows.length - 1, Math.max(0, (i < 0 ? 0 : i) + delta))];
    if (next) onSelect(next.frame.id);
  }

  return (
    <div
      className="max-h-72 overflow-auto rounded-md border border-border"
      role="region"
      aria-label="Packet list"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      <table className="w-full min-w-[720px] border-collapse text-left font-mono text-xs">
        <caption className="sr-only">
          Packets seen so far. Use the up and down arrow keys to move between packets. Selecting a packet shows its headers and bytes.
        </caption>
        <thead className="sticky top-0 z-10 bg-slate-900 text-slate-300">
          <tr>
            <th scope="col" className="px-2 py-1.5 font-medium">No.</th>
            <th scope="col" className="px-2 py-1.5 font-medium">Time (s)</th>
            {showHop && <th scope="col" className="px-2 py-1.5 font-medium">Link</th>}
            <th scope="col" className="px-2 py-1.5 font-medium">Source</th>
            <th scope="col" className="px-2 py-1.5 font-medium">Destination</th>
            <th scope="col" className="px-2 py-1.5 font-medium">Protocol</th>
            <th scope="col" className="px-2 py-1.5 font-medium">Len</th>
            <th scope="col" className="px-2 py-1.5 font-medium">Info</th>
          </tr>
        </thead>
        <tbody ref={bodyRef}>
          {rows.length === 0 && (
            <tr>
              <td colSpan={showHop ? 8 : 7} className="px-3 py-6 text-center font-sans text-sm text-muted-foreground">
                No packets yet. Press Play, or Step, to start the run.
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const d = dissected.get(r.frame.id);
            const isSel = r.frame.id === selectedFrame;
            const color = protocolColor(d?.protocol ?? "");
            return (
              <tr
                key={`${r.no}-${r.frame.id}`}
                aria-selected={isSel}
                onClick={() => onSelect(r.frame.id)}
                className={cn(
                  "cursor-pointer border-t border-white/5 hover:bg-white/5",
                  isSel && "bg-indigo-500/25 outline outline-1 -outline-offset-1 outline-indigo-400",
                  r.frame.dropped && "text-red-300",
                )}
              >
                <td className="px-2 py-1 text-slate-400">{r.no}</td>
                <td className="px-2 py-1 text-slate-300">{formatSeconds(r.time - first)}</td>
                {showHop && (
                  <td className="whitespace-nowrap px-2 py-1 text-slate-400">
                    {deviceName(trace, r.frame.from.device)} → {deviceName(trace, r.frame.to.device)}
                  </td>
                )}
                <td className="whitespace-nowrap px-2 py-1">{d?.src}</td>
                <td className="whitespace-nowrap px-2 py-1">{d?.dst}</td>
                <td className="px-2 py-1">
                  <span className="rounded px-1.5 py-0.5 font-semibold" style={{ color, backgroundColor: `${color}22`, border: `1px solid ${color}66` }}>
                    {d?.protocol}
                  </span>
                </td>
                <td className="px-2 py-1 text-slate-300">{r.frame.bytes.length}</td>
                <td className="px-2 py-1">
                  {d?.info}
                  {r.frame.dropped && <span className="ml-2 rounded bg-red-500/20 px-1 text-red-200">lost: {r.frame.dropped}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

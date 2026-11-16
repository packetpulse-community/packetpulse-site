"use client";

import type { Dissection } from "@packetpulse/netsim";
import { cn } from "@/shared/utils/cn";
import { OSI_LAYERS, TCPIP_LAYERS } from "../lib/format";

interface Props {
  dissection: Dissection | null;
  onFocusLayer: (osi: number) => void;
}

const TINT: Record<string, string> = {
  application: "border-emerald-400/60",
  transport: "border-teal-400/60",
  internet: "border-sky-400/60",
  link: "border-slate-400/60",
};

export function ModelPanel({ dissection, onFocusLayer }: Props) {
  const used = new Set<number>(dissection ? [1, ...dissection.layers.map((l) => l.osi)] : []);
  const usedTcpip = new Set(dissection?.layers.map((l) => l.tcpip) ?? []);
  if (dissection) usedTcpip.add("link");

  return (
    <div className="flex flex-col gap-3">
      <div
        className="grid gap-x-3 gap-y-1"
        style={{ gridTemplateColumns: "minmax(0,1.25fr) minmax(0,1fr)", gridTemplateRows: "auto repeat(7, minmax(46px, auto))" }}
      >
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400" style={{ gridColumn: 1, gridRow: 1 }}>OSI model (7 layers)</div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400" style={{ gridColumn: 2, gridRow: 1 }}>TCP/IP model (4 layers)</div>

        {OSI_LAYERS.map((l, i) => {
          const on = used.has(l.n);
          const noteOnly = (l.n === 5 || l.n === 6) && !on;
          return (
            <button
              key={l.n}
              type="button"
              disabled={!on}
              onClick={() => onFocusLayer(l.n)}
              aria-label={`OSI layer ${l.n}, ${l.name}. ${on ? "Used by the selected packet. Show its bytes." : "Not used by the selected packet."}`}
              className={cn(
                "flex items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors",
                on ? "border-indigo-400 bg-indigo-500/20 hover:bg-indigo-500/30" : "border-border bg-black/10 text-slate-400",
              )}
              style={{ gridColumn: 1, gridRow: i + 2 }}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/40 font-mono text-sm font-bold">{l.n}</span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold">{l.name}</span>
                <span className="text-xs text-slate-400">
                  {l.pdu} · {l.examples}
                  {noteOnly && " · in TCP/IP the application does this"}
                </span>
              </span>
            </button>
          );
        })}

        {TCPIP_LAYERS.map((l) => {
          const rows = l.osi.map((n) => OSI_LAYERS.findIndex((o) => o.n === n) + 2);
          const start = Math.min(...rows);
          const on = usedTcpip.has(l.key);
          return (
            <div
              key={l.name}
              className={cn("flex flex-col justify-center rounded-md border-2 px-3 py-2", TINT[l.key], on ? "bg-white/10" : "bg-black/10 opacity-70")}
              style={{ gridColumn: 2, gridRow: `${start} / span ${rows.length}` }}
            >
              <span className="text-sm font-semibold">{l.name}</span>
              <span className="text-xs text-slate-400">OSI {l.osi.join(", ")}</span>
            </div>
          );
        })}
      </div>

      {dissection && (
        <div>
          <p className="mb-1 text-xs text-slate-400">Where the {dissection.length} bytes of this frame go</p>
          <div className="flex h-7 overflow-hidden rounded border border-border" role="img" aria-label={dissection.layers.map((l) => `${l.name}: ${l.length} bytes`).join(", ")}>
            {dissection.layers.map((l, i) => (
              <div
                key={`${l.id}-${i}`}
                className="flex items-center justify-center overflow-hidden border-r border-black/40 px-1 text-[11px] font-semibold text-slate-900"
                style={{ width: `${Math.max(4, (l.length / dissection.length) * 100)}%`, backgroundColor: ["#cbd5e1", "#7dd3fc", "#5eead4", "#86efac"][i % 4] }}
                title={`${l.name}: ${l.length} bytes`}
              >
                {l.length}
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-400">Each box is one layer's header (or the data it carries), in bytes, outermost first.</p>
        </div>
      )}
    </div>
  );
}

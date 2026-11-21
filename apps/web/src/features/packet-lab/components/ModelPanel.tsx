"use client";

import type { Dissection } from "@packetpulse/netsim";
import { cn } from "@/shared/utils/cn";
import { layerColor, layerSoft, OSI_LAYERS, TCPIP_LAYERS } from "../lib/format";

interface Props {
  dissection: Dissection | null;
  onFocusLayer: (osi: number) => void;
}

// TCP/IP layers take the hue of the protocol that lives there; every box also names its layer.
const TINT: Record<string, string> = {
  application: "http",
  transport: "tcp",
  internet: "ip",
  link: "eth",
};

export function ModelPanel({ dissection, onFocusLayer }: Props) {
  const used = new Set<number>(dissection ? [1, ...dissection.layers.map((l) => l.osi)] : []);
  const usedTcpip = new Set(dissection?.layers.map((l) => l.tcpip) ?? []);
  if (dissection) usedTcpip.add("link");

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto" role="region" aria-label="OSI and TCP/IP layer diagram (scrolls sideways on narrow screens)" tabIndex={0}>
      <div
        className="grid min-w-[480px] gap-x-3 gap-y-1"
        style={{ gridTemplateColumns: "minmax(0,1.25fr) minmax(0,1fr)", gridTemplateRows: "auto repeat(7, minmax(46px, auto))" }}
      >
        <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary" style={{ gridColumn: 1, gridRow: 1 }}>OSI model (7 layers)</div>
        <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary" style={{ gridColumn: 2, gridRow: 1 }}>TCP/IP model (4 layers)</div>

        {OSI_LAYERS.map((l, i) => {
          const on = used.has(l.n);
          const noteOnly = (l.n === 5 || l.n === 6) && !on;
          return (
            <button
              key={l.n}
              type="button"
              disabled={!on}
              onClick={() => onFocusLayer(l.n)}
              className={cn(
                "flex items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors",
                on ? "border-primary bg-surface-subtle hover:bg-border" : "border-border bg-surface text-text-secondary",
              )}
              style={{ gridColumn: 1, gridRow: i + 2 }}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-subtle font-mono text-sm font-bold"><span className="sr-only">OSI layer </span>{l.n}</span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold">{l.name}</span>
                <span className="text-xs text-text-secondary">
                  {l.pdu} · {l.examples}
                  {noteOnly && " · in TCP/IP the application does this"}
                </span>
                <span className="sr-only">
                  {on ? "Used by the selected packet. Show its bytes." : "Not used by the selected packet."}
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
              className={cn("flex flex-col justify-center rounded-md border-2 px-3 py-2", on ? "" : "border-dashed")}
              style={{ gridColumn: 2, gridRow: `${start} / span ${rows.length}`, borderColor: layerColor(TINT[l.key] as string), backgroundColor: on ? layerSoft(TINT[l.key] as string) : "var(--grove-surface)" }}
            >
              <span className="text-sm font-semibold">{l.name}</span>
              <span className="text-xs text-text-secondary">OSI {l.osi.join(", ")}</span>
            </div>
          );
        })}
      </div>
      </div>

      {dissection && (
        <div>
          <p className="mb-1 text-xs text-text-secondary">Where the {dissection.length} bytes of this frame go</p>
          <div className="flex h-7 overflow-hidden rounded border border-border" role="img" aria-label={dissection.layers.map((l) => `${l.name}: ${l.length} bytes`).join(", ")}>
            {dissection.layers.map((l, i) => (
              <div
                key={`${l.id}-${i}`}
                className="flex items-center justify-center overflow-hidden border-r border-surface px-1 text-[11px] font-semibold text-text"
                style={{ width: `${Math.max(4, (l.length / dissection.length) * 100)}%`, backgroundColor: layerSoft(l.id), boxShadow: `inset 0 -3px 0 ${layerColor(l.id)}` }}
                title={`${l.name}: ${l.length} bytes`}
              >
                {l.length}
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-text-secondary">Each box is one layer's header (or the data it carries), in bytes, outermost first.</p>
        </div>
      )}
    </div>
  );
}

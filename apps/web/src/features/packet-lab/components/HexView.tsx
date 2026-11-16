"use client";

import type { Dissection } from "@packetpulse/netsim";
import { cn } from "@/shared/utils/cn";
import type { ByteRange } from "./FieldTree";

const LAYER_TINT: Record<string, string> = {
  eth: "bg-slate-400/15",
  arp: "bg-amber-400/15",
  ip: "bg-sky-400/15",
  icmp: "bg-cyan-400/15",
  udp: "bg-violet-400/15",
  tcp: "bg-teal-400/15",
  dns: "bg-fuchsia-400/15",
  http: "bg-emerald-400/15",
  data: "bg-emerald-400/10",
};

interface Props {
  bytes: Uint8Array;
  dissection: Dissection;
  highlight: ByteRange | null;
  onHighlight: (range: ByteRange | null) => void;
}

const hex2 = (n: number) => n.toString(16).padStart(2, "0");
const printable = (n: number) => (n >= 32 && n < 127 ? String.fromCharCode(n) : ".");

export function HexView({ bytes, dissection, highlight, onHighlight }: Props) {
  const rows: number[] = [];
  for (let o = 0; o < bytes.length; o += 16) rows.push(o);

  const layerOf = (offset: number) => dissection.layers.filter((l) => offset >= l.offset && offset < l.offset + l.length).pop();
  const fieldAt = (offset: number) => {
    const layer = layerOf(offset);
    if (!layer) return null;
    let best: ByteRange | null = null;
    const walk = (fs: typeof layer.fields) => {
      for (const f of fs) {
        if (offset >= f.offset && offset < f.offset + f.length && f.length > 0) best = { offset: f.offset, length: f.length };
        if (f.children) walk(f.children);
      }
    };
    walk(layer.fields);
    return best;
  };
  const inRange = (o: number) => !!highlight && o >= highlight.offset && o < highlight.offset + highlight.length;

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-black/30 p-2 font-mono text-xs" role="region" aria-label="Raw bytes in hexadecimal and ASCII">
      <p className="sr-only">
        {bytes.length} bytes. {highlight ? `Selected bytes ${highlight.offset} to ${highlight.offset + highlight.length - 1}.` : "Select a field in the Fields tab or a byte here to highlight it."}
      </p>
      <div className="min-w-[660px]">
        {rows.map((start) => {
          const slice = Array.from(bytes.subarray(start, start + 16));
          return (
            <div key={start} className="flex gap-3 leading-6">
              <span className="w-12 shrink-0 select-none text-slate-500">{start.toString(16).padStart(4, "0")}</span>
              <span className="flex shrink-0 gap-x-1">
                {slice.map((b, i) => {
                  const o = start + i;
                  const layer = layerOf(o);
                  return (
                    <button
                      key={o}
                      type="button"
                      tabIndex={-1}
                      aria-label={`byte ${o}: ${hex2(b)}`}
                      onClick={() => onHighlight(fieldAt(o))}
                      className={cn(
                        "w-5 rounded-sm text-center hover:bg-white/20",
                        layer ? LAYER_TINT[layer.id] : "",
                        i === 7 && "mr-2",
                        inRange(o) && "bg-amber-300 text-slate-900 hover:bg-amber-300",
                      )}
                    >
                      {hex2(b)}
                    </button>
                  );
                })}
              </span>
              <span className="w-[9.5rem] shrink-0 whitespace-pre text-slate-300" aria-hidden="true">
                {slice.map((b, i) => (
                  <span key={i} className={cn(inRange(start + i) && "bg-amber-300 text-slate-900")}>{printable(b)}</span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

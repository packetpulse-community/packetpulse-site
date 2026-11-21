"use client";

import type { Dissection } from "@packetpulse/netsim";
import { cn } from "@/shared/utils/cn";
import { layerColor, layerSoft } from "../lib/format";
import type { ByteRange } from "./FieldTree";


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
    <div className="overflow-x-auto rounded-md border border-border bg-surface-subtle p-2 font-mono text-xs" role="region" aria-label="Raw bytes in hexadecimal and ASCII">
      <p className="sr-only">
        {bytes.length} bytes. {highlight ? `Selected bytes ${highlight.offset} to ${highlight.offset + highlight.length - 1}.` : "Select a field in the Fields tab or a byte here to highlight it."}
      </p>
      <ul className="mb-2 flex flex-wrap gap-1.5 font-sans" aria-label="Layers in this frame, outermost first">
        {dissection.layers.map((l, i) => (
          <li
            key={`${l.id}-${i}`}
            className="rounded border px-1.5 py-0.5 text-[11px] font-semibold text-text"
            style={{ backgroundColor: layerSoft(l.id), borderColor: layerColor(l.id) }}
          >
            {l.name} · bytes {l.offset}–{l.offset + l.length - 1}
          </li>
        ))}
      </ul>
      <div className="min-w-[660px]">
        {rows.map((start) => {
          const slice = Array.from(bytes.subarray(start, start + 16));
          return (
            <div key={start} className="flex gap-3 leading-6">
              <span className="w-12 shrink-0 select-none text-text-secondary">{start.toString(16).padStart(4, "0")}</span>
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
                        "w-5 rounded-sm border-b-2 border-transparent text-center text-text hover:bg-surface",
                        i === 7 && "mr-2",
                        inRange(o) && "bg-accent text-accent-foreground hover:bg-accent",
                      )}
                      style={layer && !inRange(o) ? { backgroundColor: layerSoft(layer.id), borderBottomColor: layerColor(layer.id) } : undefined}
                      title={layer?.name}
                    >
                      {hex2(b)}
                    </button>
                  );
                })}
              </span>
              <span className="w-[9.5rem] shrink-0 whitespace-pre text-text-secondary" aria-hidden="true">
                {slice.map((b, i) => (
                  <span key={i} className={cn(inRange(start + i) && "bg-accent text-accent-foreground")}>{printable(b)}</span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

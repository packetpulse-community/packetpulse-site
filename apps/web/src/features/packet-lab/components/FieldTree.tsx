"use client";

import type { Dissection, Field, Layer } from "@packetpulse/netsim";
import { cn } from "@/shared/utils/cn";

export interface ByteRange {
  offset: number;
  length: number;
}

interface Props {
  dissection: Dissection;
  highlight: ByteRange | null;
  onHighlight: (range: ByteRange | null) => void;
}

function FieldRow({ field, depth, highlight, onHighlight }: { field: Field; depth: number; highlight: ByteRange | null; onHighlight: Props["onHighlight"] }) {
  const active = highlight?.offset === field.offset && highlight?.length === field.length;
  const hasChildren = !!field.children?.length;
  const row = (
    <button
      type="button"
      onClick={() => onHighlight(active ? null : { offset: field.offset, length: field.length })}
      aria-pressed={active}
      className={cn(
        "flex w-full flex-col items-start gap-0.5 rounded px-2 py-1 text-left hover:bg-surface-subtle",
        active && "bg-warning-soft outline outline-1 -outline-offset-1 outline-warning",
      )}
      style={{ paddingLeft: 8 + depth * 14 }}
    >
      <span className="font-mono text-xs">
        <span className="text-text-secondary">{field.name}: </span>
        <span className={cn("text-text", field.status === "bad" && "text-danger", field.status === "ok" && "text-success")}>
          {field.value}
        </span>
        <span className="ml-2 text-[11px] text-text-secondary">
          {field.length} {field.length === 1 ? "byte" : "bytes"} @ {field.offset}
        </span>
      </span>
      {field.note && <span className="font-sans text-xs text-text-secondary">{field.note}</span>}
    </button>
  );
  if (!hasChildren) return row;
  return (
    <div>
      {row}
      {field.children?.map((c, i) => (
        <FieldRow key={`${c.name}-${i}`} field={c} depth={depth + 1} highlight={highlight} onHighlight={onHighlight} />
      ))}
    </div>
  );
}

function LayerBlock({ layer, highlight, onHighlight }: { layer: Layer; highlight: ByteRange | null; onHighlight: Props["onHighlight"] }) {
  return (
    <details open className="rounded-md border border-border bg-surface">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm font-semibold">
        <span>{layer.name}</span>
        <span className="flex items-center gap-2 text-[11px] font-normal text-text-secondary">
          <span className="rounded bg-surface-subtle px-1.5 py-0.5">OSI layer {layer.osi}</span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onHighlight({ offset: layer.offset, length: layer.length });
            }}
            className="rounded bg-surface-subtle px-1.5 py-0.5 hover:bg-border"
          >
            {layer.length} bytes: show in hex
          </button>
        </span>
      </summary>
      <div className="flex flex-col pb-2">
        {layer.fields.map((f, i) => (
          <FieldRow key={`${f.name}-${i}`} field={f} depth={0} highlight={highlight} onHighlight={onHighlight} />
        ))}
      </div>
    </details>
  );
}

export function FieldTree({ dissection, highlight, onHighlight }: Props) {
  return (
    <div className="flex flex-col gap-2" role="tree" aria-label="Packet headers, outermost first">
      {dissection.layers.map((l) => (
        <LayerBlock key={`${l.id}-${l.offset}`} layer={l} highlight={highlight} onHighlight={onHighlight} />
      ))}
    </div>
  );
}

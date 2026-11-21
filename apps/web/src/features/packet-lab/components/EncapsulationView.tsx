"use client";

import { useEffect, useState } from "react";
import type { Dissection, Layer } from "@packetpulse/netsim";
import { Play, RotateCcw, Square } from "lucide-react";
import { layerColor, layerSoft } from "../lib/format";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

const WHY: Record<string, string> = {
  http: "Application layer: the program's own message. Here it is HTTP, which is plain text.",
  dns: "Application layer: a DNS question or answer, in DNS's compact binary format.",
  data: "More bytes of the application message that started in an earlier segment.",
  tcp: "Transport layer: adds ports (which program), sequence and acknowledgment numbers (reliable, ordered delivery) and control flags.",
  udp: "Transport layer: adds ports and a length. No handshake and no delivery guarantee.",
  icmp: "A network-layer control message. It has no ports because it talks to the IP layer itself.",
  ip: "Network layer: adds the source and destination IP addresses (end to end) and the TTL.",
  arp: "Resolves an IP address to a MAC address. It rides straight inside an Ethernet frame, with no IP header.",
  eth: "Data link layer: adds the source and destination MAC addresses (this hop only) and the type of what is inside.",
};

function Nest({ layers, total }: { layers: Layer[]; total: number }) {
  const [outer, ...inner] = layers;
  if (!outer) return null;
  return (
    <div className="rounded-md border-2 p-2 transition-all" style={{ borderColor: layerColor(outer.id), backgroundColor: layerSoft(outer.id) }}>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-text">{outer.name}</span>
        <span className="font-mono text-text-secondary">
          {outer.id === "http" || outer.id === "data" || outer.id === "dns" ? `${outer.length} bytes of data` : `${outer.length}-byte header`}
          {" · OSI "}{outer.osi}
        </span>
      </div>
      <p className="mb-2 text-xs text-text-secondary">{WHY[outer.id]}</p>
      {inner.length > 0 ? <Nest layers={inner} total={total} /> : null}
    </div>
  );
}

export function EncapsulationView({ dissection }: { dissection: Dissection | null }) {
  const reduced = usePrefersReducedMotion();
  const layers = dissection?.layers ?? [];
  const max = layers.length + 1; // the last step is "bits on the wire"
  const [step, setStep] = useState(max);
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    setStep(max);
    setAuto(false);
  }, [dissection, max]);

  useEffect(() => {
    if (!auto) return;
    if (step >= max) {
      setAuto(false);
      return;
    }
    const id = setTimeout(() => setStep((s) => s + 1), 1100);
    return () => clearTimeout(id);
  }, [auto, step, max]);

  if (!dissection) {
    return <p className="text-sm text-muted-foreground">Select a packet to see how its layers were wrapped around the data.</p>;
  }

  const built = layers.slice(Math.max(0, layers.length - step));
  const wire = step > layers.length;
  const sample = dissection.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (auto) setAuto(false);
            else {
              setStep(0);
              setAuto(!reduced);
              if (reduced) setStep(1);
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {auto ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {auto ? "Stop" : reduced ? "Start building" : "Build it step by step"}
        </button>
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="rounded-md border border-control px-3 py-1.5 text-sm hover:bg-surface-subtle disabled:opacity-40">
          Previous
        </button>
        <button type="button" onClick={() => setStep((s) => Math.min(max, s + 1))} disabled={step >= max} className="rounded-md border border-control px-3 py-1.5 text-sm hover:bg-surface-subtle disabled:opacity-40">
          Next layer
        </button>
        <button type="button" onClick={() => { setStep(max); setAuto(false); }} className="inline-flex items-center gap-1 rounded-md border border-control px-3 py-1.5 text-sm hover:bg-surface-subtle" aria-label="Show the finished frame">
          <RotateCcw className="h-4 w-4" /> Finished
        </button>
        <span className="text-xs text-text-secondary" aria-live="polite">
          Step {Math.min(step, max)} of {max}: {step === 0 ? "start" : wire ? "bits on the wire" : (built[0]?.name ?? "")}
        </span>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-xs uppercase tracking-wide text-text-secondary">Sender: each layer wraps the one above it (encapsulation). The receiver peels them off in the opposite order.</p>
        {step === 0 ? (
          <p className="text-sm text-text-secondary">Nothing built yet. The application has a message to send.</p>
        ) : (
          <Nest layers={built} total={sample} />
        )}
        {wire && (
          <div className="mt-3 rounded-md border-2 border-dashed border-control p-2 text-xs text-text-secondary">
            <span className="font-semibold text-text">Physical layer (OSI 1):</span> the finished frame is {sample} bytes, which is {sample * 8} bits, sent as electrical or optical signals. The bits start with the Ethernet header, then the layers above it.
          </div>
        )}
      </div>
    </div>
  );
}

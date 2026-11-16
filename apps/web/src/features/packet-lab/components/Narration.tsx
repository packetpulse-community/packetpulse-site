"use client";

import type { Trace, TraceEvent } from "@packetpulse/netsim";
import { cn } from "@/shared/utils/cn";

interface Props {
  trace: Trace;
  eventTimes: number[];
  time: number;
  playing: boolean;
}

const nameOf = (trace: Trace, id: string) => trace.devices.find((d) => d.id === id)?.name ?? id;

export function Narration({ trace, eventTimes, time, playing }: Props) {
  const visible: { e: TraceEvent; t: number }[] = [];
  trace.events.forEach((e, i) => {
    const t = eventTimes[i] ?? 0;
    if (t <= time && e.kind !== "state") visible.push({ e, t });
  });
  const phases = visible.filter((v) => v.e.kind === "phase");
  const phase = phases[phases.length - 1]?.e;
  const phaseIndex = phase ? visible.findIndex((v) => v.e === phase) : -1;
  const notes = visible.slice(phaseIndex + 1).filter((v) => v.e.kind === "note").slice(-5);

  return (
    <div className="flex flex-col gap-3" aria-live={playing ? "off" : "polite"} aria-atomic="false">
      {phase && phase.kind === "phase" ? (
        <div className="rounded-lg border border-indigo-400/50 bg-indigo-500/15 p-3">
          <p className="text-sm font-semibold text-indigo-100">{phase.title}</p>
          <p className="mt-1 text-sm text-slate-200">{phase.text}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-black/20 p-3 text-sm text-slate-300">
          Press <strong>Play</strong> to watch the whole story, or <strong>Step</strong> to move one packet at a time. Each step is explained here.
        </div>
      )}
      {notes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {notes.map(({ e }, i) =>
            e.kind === "note" ? (
              <li
                key={`${e.t}-${i}-${e.device}`}
                className={cn("rounded-md border border-border bg-black/20 p-2 text-sm", i === notes.length - 1 && "border-amber-300/60 bg-amber-300/10")}
              >
                <div className="mb-0.5 flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
                  <span className="rounded bg-white/10 px-1.5 py-0.5 font-semibold text-slate-200">{nameOf(trace, e.device)}</span>
                  {e.layer !== null && <span>OSI layer {e.layer}</span>}
                </div>
                {e.text}
              </li>
            ) : null,
          )}
        </ul>
      )}
    </div>
  );
}

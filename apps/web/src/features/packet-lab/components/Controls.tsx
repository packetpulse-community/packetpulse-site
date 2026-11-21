"use client";

import { Pause, Play, RotateCcw, SkipBack, SkipForward, Download } from "lucide-react";
import type { Scenario, Trace } from "@packetpulse/netsim";
import { toPcap } from "@packetpulse/netsim";
import { cn } from "@/shared/utils/cn";

interface Props {
  scenarios: Scenario[];
  scenarioId: string;
  onScenario: (id: string) => void;
  trace: Trace;
  playing: boolean;
  onPlayPause: () => void;
  onBack: () => void;
  onForward: () => void;
  onRestart: () => void;
  speed: number;
  onSpeed: (s: number) => void;
  time: number;
  total: number;
  onSeek: (t: number) => void;
  capture: string;
  onCapture: (c: string) => void;
  lossy: boolean;
  onLossy: (v: boolean) => void;
  lossApplies: boolean;
  follow: boolean;
  onFollow: (v: boolean) => void;
  reducedMotion: boolean;
}

const btn =
  "inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-md border border-control bg-surface px-3 text-sm font-medium text-text hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-40";

export function Controls(p: Props) {
  function exportPcap() {
    const bytes = toPcap(p.trace, p.capture);
    const blob = new Blob([bytes as BlobPart], { type: "application/vnd.tcpdump.pcap" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `packet-lab-${p.trace.scenarioId}-${p.capture}.pcap`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-sm" role="group" aria-label="Playback and capture controls">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="scenario">Scenario</label>
        <select
          id="scenario"
          value={p.scenarioId}
          onChange={(e) => p.onScenario(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-2 text-sm"
        >
          {p.scenarios.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>

        <button type="button" className={btn} onClick={p.onRestart} aria-label="Restart"><RotateCcw className="h-4 w-4" /></button>
        <button type="button" className={btn} onClick={p.onBack} aria-label="Step back one packet"><SkipBack className="h-4 w-4" /></button>
        <button type="button" className={cn(btn, "border-primary bg-primary text-primary-foreground hover:bg-primary-hover")} onClick={p.onPlayPause} aria-label={p.playing ? "Pause" : "Play"}>
          {p.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {p.playing ? "Pause" : "Play"}
        </button>
        <button type="button" className={btn} onClick={p.onForward} aria-label="Step forward one packet"><SkipForward className="h-4 w-4" /><span className="hidden sm:inline">Step</span></button>

        <label className="flex items-center gap-1.5 text-sm text-text-secondary">
          Speed
          <select value={p.speed} onChange={(e) => p.onSpeed(Number(e.target.value))} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={4}>4×</option>
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <label htmlFor="timeline" className="sr-only">Position in the run</label>
        <input
          id="timeline"
          type="range"
          min={0}
          max={Math.round(p.total)}
          step={10}
          value={Math.round(Math.min(p.time, p.total))}
          onChange={(e) => p.onSeek(Number(e.target.value))}
          className="h-2 w-full cursor-pointer accent-primary"
          aria-valuetext={`${Math.round((p.time / Math.max(1, p.total)) * 100)} percent through the run`}
        />
        <span className="w-12 shrink-0 text-right font-mono text-xs text-text-secondary">{Math.round((p.time / Math.max(1, p.total)) * 100)}%</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <label className="flex items-center gap-1.5 text-text-secondary">
          Capture at
          <select value={p.capture} onChange={(e) => p.onCapture(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            {p.trace.devices.filter((d) => d.kind === "host").map((d) => (
              <option key={d.id} value={d.id}>{d.name}&apos;s network card</option>
            ))}
            <option value="all">Every link (each frame, each hop)</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-text-secondary">
          <input type="checkbox" checked={p.follow} onChange={(e) => p.onFollow(e.target.checked)} className="h-4 w-4 accent-primary" />
          Follow the latest packet
        </label>
        <label className={cn("flex items-center gap-1.5", p.lossApplies ? "text-text-secondary" : "text-text-secondary opacity-60")}>
          <input type="checkbox" checked={p.lossy} disabled={!p.lossApplies} onChange={(e) => p.onLossy(e.target.checked)} className="h-4 w-4 accent-danger" />
          Make the router link lose 20% of frames
        </label>
        <button type="button" onClick={exportPcap} className={cn(btn, "h-9 text-xs")}>
          <Download className="h-4 w-4" /> Download .pcap for Wireshark
        </button>
        {p.reducedMotion && <span className="text-xs text-warning">Reduced motion is on: use Step to advance.</span>}
      </div>
    </div>
  );
}

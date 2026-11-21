"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SCENARIOS, buildTimeline, captureAt, dissectTrace, runScenario, HOP_MS } from "@packetpulse/netsim";
import { cn } from "@/shared/utils/cn";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { Controls } from "./Controls";
import { DeviceInspector } from "./DeviceInspector";
import { EncapsulationView } from "./EncapsulationView";
import { FieldTree, type ByteRange } from "./FieldTree";
import { HexView } from "./HexView";
import { ModelPanel } from "./ModelPanel";
import { Narration } from "./Narration";
import "../styles/packet-lab.css";
import { PacketTable } from "./PacketTable";
import { SequenceView } from "./SequenceView";
import { TopologyView } from "./TopologyView";

function Panel({ title, hint, children, className }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm", className)}>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {hint && <p className="text-xs text-text-secondary">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Tabs<T extends string>({ value, onChange, tabs, label }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: string }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-md bg-surface-subtle p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "rounded px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus",
            value === t.id ? "bg-primary text-primary-foreground" : "text-text-secondary hover:bg-border",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

const LOSS_SEED = 5; // a seed whose run shows a retransmission

export function PacketLab({ initialScenario }: { initialScenario: string }) {
  const [scenarioId, setScenarioId] = useState(SCENARIOS.some((s) => s.id === initialScenario) ? initialScenario : "web-page");
  const [lossy, setLossy] = useState(false);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? (SCENARIOS[0] as (typeof SCENARIOS)[number]);
  const lossApplies = scenario.id !== "ping-lan";

  const trace = useMemo(
    () => runScenario(scenarioId, lossy && lossApplies ? { lossPct: 20, seed: LOSS_SEED } : {}),
    [scenarioId, lossy, lossApplies],
  );
  const dissected = useMemo(() => dissectTrace(trace), [trace]);
  const timeline = useMemo(() => buildTimeline(trace), [trace]);
  const reduced = usePrefersReducedMotion();

  const [capture, setCapture] = useState("pc-a");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [follow, setFollow] = useState(true);
  const [pinned, setPinned] = useState<number | null>(null);
  const [inspect, setInspect] = useState<string | null>("pc-a");
  const [highlight, setHighlight] = useState<ByteRange | null>(null);
  const [lowerTab, setLowerTab] = useState<"packets" | "sequence">("packets");
  const [detailTab, setDetailTab] = useState<"fields" | "bytes">("fields");
  const timeRef = useRef(0);

  const setTimeBoth = useCallback((t: number) => {
    timeRef.current = t;
    setTime(t);
  }, []);

  // A new scenario or fault setting starts again from the beginning.
  useEffect(() => {
    setTimeBoth(0);
    setPlaying(false);
    setPinned(null);
    setHighlight(null);
  }, [trace, setTimeBoth]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = timeRef.current + (now - last) * speed;
      last = now;
      if (next >= timeline.totalMs) {
        setTimeBoth(timeline.totalMs);
        setPlaying(false);
        return;
      }
      setTimeBoth(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, timeline.totalMs, setTimeBoth]);

  const ends = useMemo(() => [...new Set([...timeline.hops.values()].map((h) => h.end))].sort((a, b) => a - b), [timeline]);

  const allRows = useMemo(() => captureAt(trace, capture), [trace, capture]);
  const rowTime = useCallback(
    (p: (typeof allRows)[number]) => {
      const h = timeline.hops.get(p.frame.id);
      if (!h) return 0;
      return p.direction === "rx" ? h.end : h.start;
    },
    [timeline],
  );
  const rows = useMemo(() => allRows.filter((r) => rowTime(r) <= time), [allRows, rowTime, time]);

  const latest = rows[rows.length - 1]?.frame.id ?? null;
  const selectedFrame = follow ? latest : (pinned ?? latest);
  const selectedFrameObj = selectedFrame !== null ? trace.frames.find((f) => f.id === selectedFrame) : undefined;
  const selectedDiss = selectedFrame !== null ? (dissected.get(selectedFrame) ?? null) : null;

  const arrived = trace.frames
    .filter((f) => (timeline.hops.get(f.id)?.end ?? Infinity) <= time)
    .sort((a, b) => (timeline.hops.get(b.id)?.end ?? 0) - (timeline.hops.get(a.id)?.end ?? 0))[0];
  const activeDevice = arrived && time - (timeline.hops.get(arrived.id)?.end ?? 0) < 600 ? arrived.to.device : null;

  const stepForward = () => {
    setPlaying(false);
    setTimeBoth(ends.find((e) => e > timeRef.current + 1) ?? timeline.totalMs);
  };
  const stepBack = () => {
    setPlaying(false);
    setTimeBoth([...ends].reverse().find((e) => e < timeRef.current - 1) ?? 0);
  };
  const playPause = () => {
    if (playing) setPlaying(false);
    else {
      if (timeRef.current >= timeline.totalMs - 1) setTimeBoth(0);
      setPlaying(true);
    }
  };

  const onSelectFrame = (id: number) => {
    setPinned(id);
    setFollow(false);
    setHighlight(null);
  };

  // Keyboard shortcuts: Space plays or pauses, arrow keys step (unless typing or on a control that uses them).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      if (el?.closest("[role=region]") || el?.closest("[role=tablist]")) return;
      if (e.key === " " && tag !== "BUTTON") {
        e.preventDefault();
        playPause();
      } else if (e.key === "ArrowRight") stepForward();
      else if (e.key === "ArrowLeft") stepBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const focusLayer = (osi: number) => {
    const layer = selectedDiss?.layers.find((l) => l.osi === osi);
    if (layer) {
      setHighlight({ offset: layer.offset, length: layer.length });
      setDetailTab("bytes");
    } else if (osi === 1 && selectedFrameObj) {
      setHighlight({ offset: 0, length: selectedFrameObj.bytes.length });
      setDetailTab("bytes");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <nav aria-label="Breadcrumb" className="text-sm text-text-secondary">
          <Link href="/tools" className="hover:text-foreground hover:underline">Tools</Link> / <span className="text-text">Packet Lab</span>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight">{scenario.title}</h1>
        <p className="max-w-3xl text-text-secondary">{scenario.summary}</p>
        <p className="font-mono text-sm text-text-secondary">
          <span className="text-text-secondary">$ </span>{scenario.command}
        </p>
        <details className="max-w-3xl text-sm text-text-secondary">
          <summary className="cursor-pointer font-medium text-text">What you will learn · and how accurate this is</summary>
          <ul className="mt-2 list-disc pl-5">
            {scenario.learn.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <p className="mt-3 rounded-md border border-border bg-surface p-3 text-xs">
            <strong>This is a simulation.</strong> Every frame is built byte by byte from the real header layouts, with real checksums, so you can download the
            capture and open it in Wireshark. Time is model time, not wall-clock time. TCP implements the state machine, MSS segmentation, slow start,
            delayed ACKs and retransmission, but not window scaling or SACK. DNS is one server, not the full recursive hierarchy. No encryption is shown.
          </p>
        </details>
      </header>

      <Controls
        scenarios={SCENARIOS}
        scenarioId={scenarioId}
        onScenario={(id) => {
          setScenarioId(id);
          setCapture("pc-a");
        }}
        trace={trace}
        playing={playing}
        onPlayPause={playPause}
        onBack={stepBack}
        onForward={stepForward}
        onRestart={() => {
          setPlaying(false);
          setTimeBoth(0);
          setPinned(null);
        }}
        speed={speed}
        onSpeed={setSpeed}
        time={time}
        total={timeline.totalMs}
        onSeek={(t) => {
          setPlaying(false);
          setTimeBoth(t);
        }}
        capture={capture}
        onCapture={(c) => {
          setCapture(c);
          setPinned(null);
        }}
        lossy={lossy && lossApplies}
        onLossy={setLossy}
        lossApplies={lossApplies}
        follow={follow}
        onFollow={setFollow}
        reducedMotion={reduced}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="The network" hint="Click any device to look inside it. Dots are frames travelling along the links.">
          <TopologyView
            trace={trace}
            dissected={dissected}
            hops={timeline.hops}
            time={time}
            hopMs={HOP_MS}
            selectedFrame={selectedFrame}
            activeDevice={activeDevice}
            inspectDevice={inspect}
            onSelectDevice={setInspect}
          />
        </Panel>
        <Panel title="What is happening" hint="Plain-language narration of the current step">
          <Narration trace={trace} eventTimes={timeline.eventTimes} time={time} playing={playing} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title={lowerTab === "packets" ? "Packet list" : "Sequence diagram"}
          hint={capture === "all" ? "Every frame on every link, so one packet appears once per hop" : "What this network card sent and received, like a capture in Wireshark"}
        >
          <Tabs
            label="Packet views"
            value={lowerTab}
            onChange={setLowerTab}
            tabs={[
              { id: "packets", label: "Packets" },
              { id: "sequence", label: "Sequence" },
            ]}
          />
          {lowerTab === "packets" ? (
            <PacketTable trace={trace} rows={rows} dissected={dissected} selectedFrame={selectedFrame} followLatest={follow} showHop={capture === "all"} onSelect={onSelectFrame} />
          ) : (
            <SequenceView trace={trace} dissected={dissected} hops={timeline.hops} time={time} selectedFrame={selectedFrame} onSelect={onSelectFrame} />
          )}
        </Panel>

        <Panel title="Inside the packet" hint={selectedDiss ? selectedDiss.info : "Select a packet to open it"}>
          <Tabs
            label="Packet details"
            value={detailTab}
            onChange={setDetailTab}
            tabs={[
              { id: "fields", label: "Fields" },
              { id: "bytes", label: "Raw bytes" },
            ]}
          />
          {selectedDiss && selectedFrameObj ? (
            <div className="max-h-[26rem] overflow-auto">
              {detailTab === "fields" ? (
                <FieldTree dissection={selectedDiss} highlight={highlight} onHighlight={(r) => { setHighlight(r); if (r) setDetailTab("fields"); }} />
              ) : (
                <HexView bytes={selectedFrameObj.bytes} dissection={selectedDiss} highlight={highlight} onHighlight={setHighlight} />
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No packet selected yet. Press Play or Step, then pick a row in the packet list.</p>
          )}
          {selectedDiss && selectedDiss.problems.length > 0 && (
            <p role="alert" className="rounded-md border border-danger bg-danger-soft p-2 text-sm text-danger">
              Problems found: {selectedDiss.problems.join("; ")}
            </p>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="The layers" hint="OSI and TCP/IP side by side. Layers used by the selected packet are lit. Click one to see its bytes.">
          <ModelPanel dissection={selectedDiss} onFocusLayer={focusLayer} />
        </Panel>
        <Panel title="Encapsulation" hint="How the data was wrapped, layer by layer, before it was sent">
          <EncapsulationView dissection={selectedDiss} />
        </Panel>
      </div>

      <Panel title="Inside a device" hint="The tables a device keeps, as they were at this moment of the run">
        <DeviceInspector trace={trace} eventTimes={timeline.eventTimes} time={time} deviceId={inspect} />
      </Panel>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { Play, Pause, Maximize } from "lucide-react";
import { Button } from "@/shared/ui/primitives/Button";

const PLAYBACK_RATES = [0.5, 1, 1.25, 1.5, 2] as const;

export function VideoPlayer({ src, poster }: { src: string; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState(1);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  function handleVolumeChange(value: number) {
    setVolume(value);
    if (videoRef.current) videoRef.current.volume = value;
  }

  function handleRateChange(value: number) {
    setRate(value);
    if (videoRef.current) videoRef.current.playbackRate = value;
  }

  function handleFullscreen() {
    videoRef.current?.requestFullscreen();
  }

  return (
    <div className="glass-panel flex flex-col gap-3 rounded-lg p-3">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full rounded-md"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        Your browser does not support embedded video.{" "}
        <a href={src} target="_blank" rel="noreferrer">
          Open the recording directly
        </a>
        .
      </video>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="glass" size="icon" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Volume
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Speed
          <select
            value={rate}
            onChange={(e) => handleRateChange(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            {PLAYBACK_RATES.map((r) => (
              <option key={r} value={r}>
                {r}x
              </option>
            ))}
          </select>
        </label>

        <Button variant="glass" size="icon" onClick={handleFullscreen} aria-label="Fullscreen">
          <Maximize className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

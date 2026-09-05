"use client";

import { useRef, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  inspectVideoForBoundaries,
  extractBrowserMetadata,
  type BrowserMediaMetadata,
  type SampledFrame,
  type FrameDelta,
} from "@/lib/media/intelligence";
import {
  timestampsToCandidates,
  acceptCandidate,
  rejectCandidate,
  adjustCandidate,
  effectiveBoundary,
  type SceneCandidate,
} from "@/lib/media/scene-candidates";

type CanonicalScene = {
  master_id: string;
  title: string | null;
  start_ms: number | null;
  end_ms: number | null;
};

type Props = {
  canonicalScenes: CanonicalScene[];
};

function formatMs(ms: number | null): string {
  if (ms == null) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
}

function ConfidenceBadge({ confidence }: { confidence: SceneCandidate["confidence"] }) {
  const colours: Record<string, string> = {
    high: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    medium: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    low: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colours[confidence]}`}>
      {confidence}
    </span>
  );
}

export default function MediaInspectClient({ canonicalScenes }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [hlsUrl, setHlsUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<BrowserMediaMetadata | null>(null);
  const [frames, setFrames] = useState<SampledFrame[]>([]);
  const [deltas, setDeltas] = useState<FrameDelta[]>([]);
  const [candidates, setCandidates] = useState<SceneCandidate[]>([]);
  const [inspecting, setInspecting] = useState(false);
  const [inspectMsg, setInspectMsg] = useState<string | null>(null);
  const [frameCount, setFrameCount] = useState(30);
  const [threshold, setThreshold] = useState(0.15);
  const [minDurationMs, setMinDurationMs] = useState(3000);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustStart, setAdjustStart] = useState(0);
  const [adjustEnd, setAdjustEnd] = useState(0);

  // Load a local file into the video element
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setHlsUrl(null);
    setMetadata(null);
    setFrames([]);
    setDeltas([]);
    setCandidates([]);
    setInspectMsg(null);
    const video = videoRef.current;
    if (!video) return;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    video.src = url;
  }

  // Load a Mux HLS URL into the video element
  async function loadMuxUrl(url: string) {
    const video = videoRef.current;
    if (!video) return;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (objectUrl) { URL.revokeObjectURL(objectUrl); setObjectUrl(null); }
    setHlsUrl(url);
    setMetadata(null);
    setFrames([]);
    setDeltas([]);
    setCandidates([]);
    setInspectMsg(null);
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
    } else {
      const { default: Hls } = await import("hls.js");
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
        hlsRef.current = hls;
      }
    }
  }

  const runInspection = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    setInspecting(true);
    setInspectMsg("Sampling frames…");
    setFrames([]);
    setDeltas([]);
    setCandidates([]);
    try {
      const result = await inspectVideoForBoundaries(video, {
        frameCount,
        threshold,
        minSceneDurationMs: minDurationMs,
        localMaxima: true,
        frameWidth: 160,
        frameHeight: 90,
        quality: 0.7,
      });
      setMetadata(result.metadata);
      setFrames(result.frames);
      setDeltas(result.deltas);

      // Build frame map and change score map for candidate creation
      const frameMap = new Map<number, string>();
      const scoreMap = new Map<number, number>();
      for (const f of result.frames) frameMap.set(f.timeMs, f.dataUrl);
      for (const d of result.deltas) scoreMap.set(d.fromMs, d.changeScore);

      const newCandidates = timestampsToCandidates(
        result.candidateTimestampsMs,
        result.metadata.durationMs ?? 0,
        frameMap,
        scoreMap,
      );
      setCandidates(newCandidates);
      setInspectMsg(
        `Inspection complete. ${result.frames.length} frames sampled, ${result.candidateTimestampsMs.length} boundary candidates detected.`
      );
    } catch (err) {
      setInspectMsg(`Error: ${err instanceof Error ? err.message : "Inspection failed"}`);
    } finally {
      setInspecting(false);
    }
  }, [frameCount, threshold, minDurationMs]);

  function updateCandidate(updated: SceneCandidate) {
    setCandidates((prev) => prev.map((c) => c.candidateId === updated.candidateId ? updated : c));
  }

  function jumpTo(ms: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = ms / 1000;
  }

  const durationMs = metadata?.durationMs ?? null;

  // Find closest canonical scene to a candidate
  function closestCanonical(candidate: SceneCandidate): CanonicalScene | null {
    const { startMs } = effectiveBoundary(candidate);
    let best: CanonicalScene | null = null;
    let bestDiff = Infinity;
    for (const s of canonicalScenes) {
      if (s.start_ms == null) continue;
      const diff = Math.abs(s.start_ms - startMs);
      if (diff < bestDiff) { bestDiff = diff; best = s; }
    }
    return bestDiff < 10000 ? best : null; // within 10s
  }

  return (
    <div className="space-y-6">

      {/* Media source */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Media Source</p>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Local file */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Local file (MP4, MOV, etc.)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="sr-only"
                onChange={handleFileChange}
              />
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                Choose file
              </Button>
              {objectUrl && <p className="text-xs text-foreground truncate">File loaded</p>}
            </div>

            {/* Mux HLS URL */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Mux HLS URL (stream.mux.com/…)</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://stream.mux.com/…"
                  className="border-input bg-background text-foreground flex-1 rounded-md border px-3 py-1.5 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val) loadMuxUrl(val);
                    }
                  }}
                />
                <Button size="sm" variant="outline" onClick={(e) => {
                  const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                  if (input?.value.trim()) loadMuxUrl(input.value.trim());
                }}>Load</Button>
              </div>
            </div>
          </div>

          {/* Video element */}
          <video
            ref={videoRef}
            controls
            className="w-full aspect-video bg-black rounded"
            onLoadedMetadata={() => {
              const video = videoRef.current;
              if (video) setMetadata(extractBrowserMetadata(video));
            }}
          />

          {metadata && (
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">Duration {formatMs(metadata.durationMs)}</Badge>
              {metadata.hasVideo && <Badge variant="outline">{metadata.videoWidth}×{metadata.videoHeight}</Badge>}
              <Badge variant="outline">{metadata.hasVideo ? "Video" : "Audio only"}</Badge>
              <Badge variant="secondary" className="text-[10px]">Frame rate: server-side only</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inspection controls */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Inspection Parameters</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Frames to sample</span>
              <input
                type="number"
                min={5}
                max={120}
                value={frameCount}
                onChange={(e) => setFrameCount(Number(e.target.value))}
                className="border-input bg-background text-foreground w-full rounded-md border px-3 py-1.5 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Change threshold (0–1)</span>
              <input
                type="number"
                min={0.05}
                max={0.9}
                step={0.01}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="border-input bg-background text-foreground w-full rounded-md border px-3 py-1.5 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Min scene duration (ms)</span>
              <input
                type="number"
                min={500}
                max={30000}
                step={500}
                value={minDurationMs}
                onChange={(e) => setMinDurationMs(Number(e.target.value))}
                className="border-input bg-background text-foreground w-full rounded-md border px-3 py-1.5 text-sm"
              />
            </label>
          </div>
          <Button
            size="sm"
            disabled={inspecting || (!objectUrl && !hlsUrl)}
            onClick={runInspection}
          >
            {inspecting ? "Inspecting…" : "Run Inspection"}
          </Button>
          {inspectMsg && (
            <p className={`text-sm ${inspectMsg.startsWith("Error") ? "text-destructive" : "text-foreground"}`}>
              {inspectMsg}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Frame strip */}
      {frames.length > 0 && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Sampled Frames — {frames.length} frames
            </p>
            <div className="flex gap-1 overflow-x-auto pb-2">
              {frames.map((f) => (
                <button
                  key={f.timeMs}
                  type="button"
                  onClick={() => jumpTo(f.timeMs)}
                  title={formatMs(f.timeMs)}
                  className="shrink-0 relative group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.dataUrl}
                    alt={`Frame at ${formatMs(f.timeMs)}`}
                    className="h-14 w-24 object-cover rounded border border-border group-hover:border-foreground/40 transition-colors"
                  />
                  <span className="absolute bottom-0.5 left-0.5 text-[8px] text-white/70 bg-black/50 px-0.5 rounded">
                    {formatMs(f.timeMs)}
                  </span>
                </button>
              ))}
            </div>

            {/* Delta bar chart */}
            {deltas.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Visual change scores</p>
                <div className="flex items-end gap-0.5 h-12">
                  {deltas.map((d) => {
                    const isBoundary = candidates.some((c) => c.startMs === d.fromMs && c.reviewState !== "rejected");
                    return (
                      <button
                        key={d.fromMs}
                        type="button"
                        onClick={() => jumpTo(d.fromMs)}
                        title={`${formatMs(d.fromMs)} — score: ${d.changeScore.toFixed(3)}`}
                        className="flex-1 min-w-0 rounded-sm transition-colors"
                        style={{
                          height: `${Math.max(4, d.changeScore * 100)}%`,
                          background: isBoundary
                            ? "var(--accent-mv-gold)"
                            : d.changeScore >= threshold
                            ? "var(--accent-mv)"
                            : "color-mix(in oklch, var(--accent-mv) 30%, var(--border))",
                        }}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground/60">
                  <span>0:00</span>
                  <span>{formatMs(durationMs)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Candidates vs canonical */}
      {candidates.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                AI Candidates
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                These are browser-detected boundaries — evidence only. Accept to promote to canonical via the authority API.
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-[10px]">
                {candidates.filter((c) => c.reviewState === "accepted" || c.reviewState === "adjusted").length} accepted
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {candidates.filter((c) => c.reviewState === "rejected").length} rejected
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            {candidates.map((candidate, i) => {
              const { startMs, endMs } = effectiveBoundary(candidate);
              const durationSec = endMs != null ? (endMs - startMs) / 1000 : null;
              const closest = closestCanonical(candidate);
              const isSelected = selectedCandidateId === candidate.candidateId;
              const isAdjusting = adjustingId === candidate.candidateId;

              return (
                <Card
                  key={candidate.candidateId}
                  className={`transition-colors ${
                    candidate.reviewState === "accepted" || candidate.reviewState === "adjusted"
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : candidate.reviewState === "rejected"
                      ? "border-border bg-muted/20 opacity-50"
                      : isSelected
                      ? "border-[var(--accent-mv)]/60"
                      : ""
                  }`}
                >
                  <CardContent className="pt-3 pb-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        {/* Candidate identity — clearly NOT canonical */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                            AI CANDIDATE {String(i + 1).padStart(2, "0")}
                          </span>
                          <ConfidenceBadge confidence={candidate.confidence} />
                          {candidate.changeScore != null && (
                            <span className="text-[10px] text-muted-foreground">
                              score: {candidate.changeScore.toFixed(3)}
                            </span>
                          )}
                          {candidate.reviewState !== "pending" && (
                            <Badge
                              variant={candidate.reviewState === "rejected" ? "outline" : "secondary"}
                              className="text-[10px]"
                            >
                              {candidate.reviewState}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-sm font-mono">
                          <span>{formatMs(startMs)}</span>
                          <span className="text-muted-foreground">→</span>
                          <span>{formatMs(endMs)}</span>
                          {durationSec != null && (
                            <span className="text-xs text-muted-foreground font-sans">
                              ({durationSec.toFixed(1)}s)
                            </span>
                          )}
                        </div>

                        {/* Closest canonical scene comparison */}
                        {closest && (
                          <div className="rounded border border-border bg-muted/30 px-2 py-1.5 text-xs space-y-0.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Nearest canonical scene
                            </p>
                            <p className="text-foreground font-medium">{closest.title ?? "Untitled Scene"}</p>
                            <p className="font-mono text-muted-foreground">
                              {formatMs(closest.start_ms)} → {formatMs(closest.end_ms)}
                              {closest.start_ms != null && (
                                <span className="ml-2 font-sans">
                                  (Δ {Math.abs(closest.start_ms - startMs)}ms)
                                </span>
                              )}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Representative frame */}
                      {candidate.representativeFrame && (
                        <button
                          type="button"
                          onClick={() => jumpTo(startMs)}
                          className="shrink-0"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={candidate.representativeFrame}
                            alt={`Candidate ${i + 1} frame`}
                            className="h-16 w-28 object-cover rounded border border-border hover:border-foreground/40 transition-colors"
                          />
                        </button>
                      )}
                    </div>

                    {/* Adjust form */}
                    {isAdjusting && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <label className="text-xs text-muted-foreground">
                          Start (ms)
                          <input
                            type="number"
                            value={adjustStart}
                            onChange={(e) => setAdjustStart(Number(e.target.value))}
                            className="border-input bg-background text-foreground mt-1 w-full rounded-md border px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="text-xs text-muted-foreground">
                          End (ms)
                          <input
                            type="number"
                            value={adjustEnd}
                            onChange={(e) => setAdjustEnd(Number(e.target.value))}
                            className="border-input bg-background text-foreground mt-1 w-full rounded-md border px-2 py-1 text-sm"
                          />
                        </label>
                        <div className="col-span-2 flex gap-2">
                          <Button size="sm" onClick={() => {
                            updateCandidate(adjustCandidate(candidate, adjustStart, adjustEnd));
                            setAdjustingId(null);
                          }}>Apply adjustment</Button>
                          <Button size="sm" variant="outline" onClick={() => setAdjustingId(null)}>Cancel</Button>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {candidate.reviewState !== "rejected" && !isAdjusting && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => jumpTo(startMs)}
                        >
                          Jump to {formatMs(startMs)}
                        </Button>
                        {candidate.reviewState === "pending" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => { updateCandidate(acceptCandidate(candidate)); setSelectedCandidateId(candidate.candidateId); }}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setAdjustingId(candidate.candidateId);
                                setAdjustStart(startMs);
                                setAdjustEnd(endMs ?? 0);
                              }}
                            >
                              Adjust
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateCandidate(rejectCandidate(candidate))}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {(candidate.reviewState === "accepted" || candidate.reviewState === "adjusted") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setAdjustingId(candidate.candidateId);
                              setAdjustStart(startMs);
                              setAdjustEnd(endMs ?? 0);
                            }}
                          >
                            Re-adjust
                          </Button>
                        )}
                      </div>
                    )}
                    {candidate.reviewState === "rejected" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateCandidate({ ...candidate, reviewState: "pending" })}
                      >
                        Restore
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Accepted candidates summary — operator must use authority API to commit */}
          {candidates.some((c) => c.reviewState === "accepted" || c.reviewState === "adjusted") && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="pt-3 pb-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">
                  Accepted candidates — not yet canonical
                </p>
                <p className="text-xs text-muted-foreground">
                  These boundaries have been accepted as evidence. To make them canonical, use the Scene timeline
                  editor in the authority workspace for each Scene. Candidates cannot directly create canonical records.
                </p>
                <div className="space-y-1">
                  {candidates
                    .filter((c) => c.reviewState === "accepted" || c.reviewState === "adjusted")
                    .map((c, i) => {
                      const { startMs, endMs } = effectiveBoundary(c);
                      return (
                        <p key={c.candidateId} className="font-mono text-xs text-foreground">
                          {String(i + 1).padStart(2, "0")}. {formatMs(startMs)} → {formatMs(endMs)}
                          {c.reviewState === "adjusted" && (
                            <span className="ml-2 font-sans text-amber-400 text-[10px]">adjusted</span>
                          )}
                        </p>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Canonical scenes reference */}
      {canonicalScenes.length > 0 && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Canonical Scenes — {canonicalScenes.length} scenes
            </p>
            <p className="text-xs text-muted-foreground">
              These are the authoritative Scene boundaries from the database. They are not modified by this tool.
            </p>
            <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
              {canonicalScenes.map((scene, i) => (
                <div key={scene.master_id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground/50 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {scene.title ?? <span className="italic text-muted-foreground">Untitled</span>}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {formatMs(scene.start_ms)} → {formatMs(scene.end_ms)}
                        {scene.start_ms != null && scene.end_ms != null && (
                          <span className="ml-2 font-sans">
                            ({((scene.end_ms - scene.start_ms) / 1000).toFixed(1)}s)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-[10px]">CANONICAL</Badge>
                    {scene.start_ms != null && (
                      <Button size="sm" variant="outline" onClick={() => jumpTo(scene.start_ms!)}>
                        Jump
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

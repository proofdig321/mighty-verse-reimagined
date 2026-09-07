"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import type {
  CurateUniverse,
  CurateMural,
  CurateScene,
  CurateAsset,
} from "./page";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMs(ms: number | null): string {
  if (ms == null) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
}

function fmtSec(ms: number | null): string {
  if (ms == null) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}

function pct(ms: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.max(0, (ms / total) * 100));
}

async function api(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return { ok: res.ok, ...(JSON.parse(text)) }; }
  catch { return { ok: false, error: `HTTP ${res.status}` }; }
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  universes: CurateUniverse[];
  selectedUniverseId: string | null;
  mural: CurateMural | null;
  scenes: CurateScene[];
  availableAssets: CurateAsset[];
};

// ─── Mux thumbnail URL ────────────────────────────────────────────────────────

function hlsUrl(provider: string | null, storageRef: string): string | null {
  if (provider === "mux") return `https://stream.mux.com/${storageRef}.m3u8`;
  if (provider === "livepeer") return `https://livepeercdn.studio/hls/${storageRef}/index.m3u8`;
  return null;
}

function providerThumbUrl(provider: string | null, storageRef: string, timeMs: number, width = 160): string | null {
  if (provider === "mux") return `https://image.mux.com/${storageRef}/thumbnail.jpg?time=${(timeMs / 1000).toFixed(3)}&width=${width}`;
  return null;
}


// ─── Main component ───────────────────────────────────────────────────────────

export default function CurateClient({
  universes,
  selectedUniverseId,
  mural,
  scenes: initialScenes,
  availableAssets,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Video player ────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playerError, setPlayerError] = useState<string | null>(null);

  // ── Scenes (local copy so we can add without reload) ────────────────────────
  const [scenes, setScenes] = useState<CurateScene[]>(initialScenes);

  // ── Inspection ──────────────────────────────────────────────────────────────
  const [metadata, setMetadata] = useState<BrowserMediaMetadata | null>(null);
  const [frames, setFrames] = useState<SampledFrame[]>([]);
  const [deltas, setDeltas] = useState<FrameDelta[]>([]);
  const [candidates, setCandidates] = useState<SceneCandidate[]>([]);
  const [inspecting, setInspecting] = useState(false);
  const [inspectMsg, setInspectMsg] = useState<string | null>(null);
  const [frameCount] = useState(60);
  const [threshold] = useState(0.15);

  // ── Selected candidate ──────────────────────────────────────────────────────
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustStart, setAdjustStart] = useState(0);
  const [adjustEnd, setAdjustEnd] = useState(0);

  // ── Scene creation ──────────────────────────────────────────────────────────
  const [creatingFromId, setCreatingFromId] = useState<string | null>(null);
  const [newSceneTitle, setNewSceneTitle] = useState("");
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  // ── Mural asset binding ─────────────────────────────────────────────────────
  const [bindingAsset, setBindingAsset] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState(availableAssets[0]?.asset_id ?? "");
  const [bindMsg, setBindMsg] = useState<string | null>(null);
  const [bindBusy, setBindBusy] = useState(false);

  const selectedCandidate = candidates.find((c) => c.candidateId === selectedCandidateId) ?? null;
  const effectiveDuration = durationMs || mural?.duration_ms || 0;

  // ── Load HLS into player ────────────────────────────────────────────────────
  const loadHls = useCallback(async (url: string) => {
    const video = videoRef.current;
    if (!video) return;
    hlsRef.current?.destroy();
    hlsRef.current = null;
    setPlayerReady(false);
    setPlayerError(null);

    const { default: Hls } = await import("hls.js");
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: false });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_e, d) => {
        if (d.fatal) setPlayerError(`HLS error: ${d.details}`);
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
    } else {
      setPlayerError("HLS not supported in this browser.");
    }
  }, []);

  // Auto-load when mural has a bound asset with a known HLS URL
  useEffect(() => {
    if (mural?.storage_ref) {
      const url = hlsUrl(mural.provider, mural.storage_ref);
      if (url) loadHls(url);
    }
  }, [mural?.provider, mural?.storage_ref, loadHls]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => setCurrentMs(Math.round(video.currentTime * 1000));
    const onMeta = () => {
      setDurationMs(Math.round(video.duration * 1000));
      setMetadata(extractBrowserMetadata(video));
      setPlayerReady(true);
    };
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
    };
  }, []);

  function seekTo(ms: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = ms / 1000;
  }


  // ── Run inspection ──────────────────────────────────────────────────────────
  const runInspection = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.duration || video.duration <= 0) {
      setInspectMsg("Video must be loaded before inspection.");
      return;
    }
    setInspecting(true);
    setInspectMsg("Sampling frames…");
    setFrames([]); setDeltas([]); setCandidates([]);
    try {
      const result = await inspectVideoForBoundaries(video, {
        frameCount,
        threshold,
        minSceneDurationMs: 3000,
        localMaxima: true,
        frameWidth: 160,
        frameHeight: 90,
        quality: 0.7,
      });
      setMetadata(result.metadata);
      setFrames(result.frames);
      setDeltas(result.deltas);
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
        `${result.frames.length} frames sampled · ${result.candidateTimestampsMs.length} boundary candidates`
      );
    } catch (err) {
      setInspectMsg(`Error: ${err instanceof Error ? err.message : "Inspection failed"}`);
    } finally {
      setInspecting(false);
    }
  }, [frameCount, threshold]);

  function updateCandidate(updated: SceneCandidate) {
    setCandidates((prev) => prev.map((c) => c.candidateId === updated.candidateId ? updated : c));
  }

  // ── Create canonical Scene from accepted candidate ──────────────────────────
  async function createScene(candidate: SceneCandidate) {
    if (!mural || !newSceneTitle.trim()) return;
    const { startMs, endMs } = effectiveBoundary(candidate);
    const assetId = mural.asset_id;
    if (!assetId) { setCreateMsg("Mural has no media asset bound."); return; }

    setCreateBusy(true);
    setCreateMsg(null);
    const res = await api("/api/authority/scenes", {
      mural_master_id: mural.master_id,
      title: newSceneTitle.trim(),
      start_ms: startMs,
      end_ms: endMs ?? startMs + 1000,
      asset_id: assetId,
    });
    setCreateBusy(false);
    if (!res.ok) {
      setCreateMsg(`Error: ${res.error}`);
      return;
    }
    // Add to local scenes list
    setScenes((prev) => [
      ...prev,
      {
        master_id: res.master_id,
        title: newSceneTitle.trim(),
        sort_order: null,
        start_ms: startMs,
        end_ms: endMs ?? null,
        projection_id: res.projection_id,
        asset_id: assetId,
      },
    ]);
    updateCandidate({ ...candidate, reviewState: "accepted" });
    setCreatingFromId(null);
    setNewSceneTitle("");
    setCreateMsg(`Scene "${newSceneTitle.trim()}" created.`);
  }

  // ── Bind asset to mural projection ─────────────────────────────────────────
  async function bindMuralAsset() {
    if (!mural?.projection_id || !selectedAssetId) return;
    setBindBusy(true);
    setBindMsg(null);
    const res = await api("/api/authority/media", {
      projection_id: mural.projection_id,
      master_id: mural.master_id,
      asset_id: selectedAssetId,
      rights_holder_ref: null,
      rights_basis: null,
      intake_id: null,
    });
    setBindBusy(false);
    if (!res.ok) { setBindMsg(`Error: ${res.error}`); return; }
    setBindMsg("Asset bound. Reload to see updated player.");
    setBindingAsset(false);
  }


  // ── Render ──────────────────────────────────────────────────────────────────
  const universe = universes.find((u) => u.master_id === selectedUniverseId);

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Curation Workspace</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {universe?.title ?? "Select a Universe"}
        </h1>
        {mural && (
          <p className="text-sm text-muted-foreground">
            Mural: {mural.title ?? "Untitled"} ·{" "}
            {mural.provider === "mux" ? "Mux HLS" : mural.provider ?? "No media"} ·{" "}
            {mural.duration_ms ? fmtSec(mural.duration_ms) : "—"}
          </p>
        )}
      </div>

      {/* Universe selector */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedUniverseId ?? ""}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams.toString());
            if (e.target.value) params.set("universe", e.target.value);
            else params.delete("universe");
            router.push(`/authority/curate?${params.toString()}`);
          }}
          className="border-input bg-background text-foreground rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Select Universe…</option>
          {universes.map((u) => (
            <option key={u.master_id} value={u.master_id}>
              {u.title ?? u.master_id.slice(0, 8)}
            </option>
          ))}
        </select>
        {selectedUniverseId && (
          <a
            href={`/authority/${selectedUniverseId}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Open Universe →
          </a>
        )}
        {mural && (
          <a
            href={`/authority/${mural.master_id}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Open Mural →
          </a>
        )}
      </div>

      {!selectedUniverseId && (
        <p className="text-sm text-muted-foreground">Select a Universe above to begin curation.</p>
      )}

      {selectedUniverseId && (
        <div className="space-y-6">

          {/* Mural asset binding */}
          {mural && (
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Mural media</p>
                <span className="text-xs text-muted-foreground">
                  {mural.provider ?? "no provider"} · {mural.storage_ref?.slice(0, 12) ?? "—"}
                </span>
              </div>
              {!bindingAsset ? (
                <Button size="sm" variant="outline" onClick={() => setBindingAsset(true)}>
                  Bind different asset
                </Button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedAssetId}
                    onChange={(e) => setSelectedAssetId(e.target.value)}
                    className="border-input bg-background text-foreground rounded-md border px-3 py-1.5 text-sm"
                  >
                    <option value="">Select asset…</option>
                    {availableAssets.map((a) => (
                      <option key={a.asset_id} value={a.asset_id}>
                        {a.title ?? `${a.provider ?? "unknown"} · ${a.storage_ref.slice(0, 16)}`} · {a.duration_ms ? fmtSec(a.duration_ms) : "—"}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" disabled={bindBusy || !selectedAssetId} onClick={bindMuralAsset}>
                    {bindBusy ? "Binding…" : "Bind asset"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setBindingAsset(false)}>Cancel</Button>
                </div>
              )}
              {bindMsg && <p className={`text-xs ${bindMsg.startsWith("Error") ? "text-destructive" : "text-emerald-400"}`}>{bindMsg}</p>}
            </div>
          )}

          {/* Video player */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {mural?.provider === "mux" ? "Mux HLS" : mural?.provider === "livepeer" ? "Livepeer HLS" : "Media Player"}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                  <span>{fmtMs(currentMs)}</span>
                  <span className="opacity-40">/</span>
                  <span>{fmtMs(effectiveDuration || null)}</span>
                </div>
              </div>
              <video
                ref={videoRef}
                controls
                className="w-full aspect-video bg-black rounded"
              />
              {playerError && <p className="text-xs text-destructive">{playerError}</p>}
              {!mural?.storage_ref && (
                <p className="text-xs text-muted-foreground">No media bound to this Mural.</p>
              )}
            </CardContent>
          </Card>

          {/* Visual timeline */}
          {effectiveDuration > 0 && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Timeline — {fmtSec(effectiveDuration)}
                </p>

                {/* Scrubber bar */}
                <div
                  className="relative h-8 rounded bg-muted/30 border border-border cursor-pointer overflow-hidden"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = (e.clientX - rect.left) / rect.width;
                    seekTo(Math.round(ratio * effectiveDuration));
                  }}
                >
                  {/* Playhead */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white/80 z-10 pointer-events-none"
                    style={{ left: `${pct(currentMs, effectiveDuration)}%` }}
                  />

                  {/* Canonical scenes */}
                  {scenes.map((s) =>
                    s.start_ms != null && s.end_ms != null ? (
                      <div
                        key={s.master_id}
                        className="absolute top-0 bottom-0 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
                        style={{
                          left: `${pct(s.start_ms, effectiveDuration)}%`,
                          width: `${pct(s.end_ms - s.start_ms, effectiveDuration)}%`,
                          background: "var(--accent-mv)",
                        }}
                        title={`${s.title ?? "Scene"}: ${fmtMs(s.start_ms)} → ${fmtMs(s.end_ms)}`}
                        onClick={(e) => { e.stopPropagation(); seekTo(s.start_ms!); }}
                      />
                    ) : null
                  )}

                  {/* Candidate markers */}
                  {candidates
                    .filter((c) => c.reviewState !== "rejected")
                    .map((c) => {
                      const { startMs } = effectiveBoundary(c);
                      return (
                        <div
                          key={c.candidateId}
                          className="absolute top-0 bottom-0 w-0.5 opacity-60 hover:opacity-100 cursor-pointer"
                          style={{
                            left: `${pct(startMs, effectiveDuration)}%`,
                            background: "var(--accent-mv-gold)",
                          }}
                          title={`Candidate: ${fmtMs(startMs)}`}
                          onClick={(e) => { e.stopPropagation(); setSelectedCandidateId(c.candidateId); seekTo(startMs); }}
                        />
                      );
                    })}
                </div>

                {/* Scene labels */}
                {scenes.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Canonical Scenes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {scenes.map((s) => (
                        <button
                          key={s.master_id}
                          type="button"
                          onClick={() => s.start_ms != null && seekTo(s.start_ms)}
                          className="inline-flex items-center gap-1.5 rounded border border-border bg-card/50 px-2 py-1 text-xs hover:border-[var(--accent-mv)]/60 transition-colors"
                        >
                          <span
                            className="inline-block h-2 w-2 rounded-sm shrink-0"
                            style={{ background: "var(--accent-mv)" }}
                          />
                          <span className="text-foreground">{s.title ?? "Untitled"}</span>
                          {s.start_ms != null && (
                            <span className="font-mono text-muted-foreground">{fmtMs(s.start_ms)}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Legend */}
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-3 rounded-sm" style={{ background: "var(--accent-mv)" }} />
                    Canonical Scene
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-0.5" style={{ background: "var(--accent-mv-gold)" }} />
                    Evidence candidate
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-0.5 bg-white/80" />
                    Playhead
                  </span>
                </div>
              </CardContent>
            </Card>
          )}


          {/* Inspection controls */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Media Intelligence
                </p>
                <Badge variant="outline" className="text-[10px]">Evidence only — not canonical</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Sample frames from the loaded video to detect visual boundaries. Results are evidence for curation — they do not create canonical Scenes.
              </p>
              <Button
                size="sm"
                disabled={inspecting || !playerReady}
                onClick={runInspection}
              >
                {inspecting ? "Sampling frames…" : "Run Inspection"}
              </Button>
              {inspectMsg && (
                <p className={`text-xs ${inspectMsg.startsWith("Error") ? "text-destructive" : "text-muted-foreground"}`}>
                  {inspectMsg}
                </p>
              )}
              {!playerReady && mural?.storage_ref && (
                <p className="text-xs text-muted-foreground/60">Waiting for video to load…</p>
              )}
            </CardContent>
          </Card>

          {/* Frame strip */}
          {frames.length > 0 && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Sampled Frames — {frames.length}
                </p>
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {frames.map((f) => (
                    <button
                      key={f.timeMs}
                      type="button"
                      onClick={() => seekTo(f.timeMs)}
                      title={fmtMs(f.timeMs)}
                      className="shrink-0 relative group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={f.dataUrl}
                        alt={`Frame ${fmtMs(f.timeMs)}`}
                        className="h-12 w-20 object-cover rounded border border-border group-hover:border-foreground/40 transition-colors"
                      />
                      <span className="absolute bottom-0.5 left-0.5 text-[8px] text-white/70 bg-black/50 px-0.5 rounded">
                        {fmtMs(f.timeMs)}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Delta bars */}
                {deltas.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Visual change scores</p>
                    <div className="flex items-end gap-0.5 h-10">
                      {deltas.map((d) => {
                        const isBoundary = candidates.some(
                          (c) => c.startMs === d.fromMs && c.reviewState !== "rejected"
                        );
                        return (
                          <button
                            key={d.fromMs}
                            type="button"
                            onClick={() => {
                              const c = candidates.find((c) => c.startMs === d.fromMs);
                              if (c) { setSelectedCandidateId(c.candidateId); seekTo(d.fromMs); }
                              else seekTo(d.fromMs);
                            }}
                            title={`${fmtMs(d.fromMs)} score:${d.changeScore.toFixed(3)}`}
                            className="flex-1 min-w-0 rounded-sm transition-colors"
                            style={{
                              height: `${Math.max(4, d.changeScore * 100)}%`,
                              background: isBoundary
                                ? "var(--accent-mv-gold)"
                                : d.changeScore >= threshold
                                ? "var(--accent-mv)"
                                : "color-mix(in oklch, var(--accent-mv) 25%, var(--border))",
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Candidates */}
          {candidates.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Evidence Candidates
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Browser-detected boundaries. Accept to create a canonical Scene — this requires explicit confirmation.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {candidates.filter((c) => c.reviewState === "accepted").length} accepted
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {candidates.filter((c) => c.reviewState === "rejected").length} rejected
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                {candidates.map((candidate, i) => {
                  const { startMs, endMs } = effectiveBoundary(candidate);
                  const isSelected = selectedCandidateId === candidate.candidateId;
                  const isCreating = creatingFromId === candidate.candidateId;
                  const isAdjusting = adjustingId === candidate.candidateId;

                  // Nearest canonical scene
                  let nearest: CurateScene | null = null;
                  let nearestDiff = Infinity;
                  for (const s of scenes) {
                    if (s.start_ms == null) continue;
                    const diff = Math.abs(s.start_ms - startMs);
                    if (diff < nearestDiff) { nearestDiff = diff; nearest = s; }
                  }
                  if (nearestDiff > 15000) nearest = null;

                  // Mux thumbnail if available
                  const candidateThumb = mural?.storage_ref
                    ? providerThumbUrl(mural.provider, mural.storage_ref, startMs)
                    : candidate.representativeFrame ?? null;

                  return (
                    <Card
                      key={candidate.candidateId}
                      className={`transition-colors ${
                        candidate.reviewState === "accepted"
                          ? "border-emerald-500/40 bg-emerald-500/5"
                          : candidate.reviewState === "rejected"
                          ? "border-border bg-muted/20 opacity-40"
                          : isSelected
                          ? "border-[var(--accent-mv-gold)]/60"
                          : ""
                      }`}
                    >
                      <CardContent className="pt-3 pb-3 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                EVIDENCE {String(i + 1).padStart(2, "0")}
                              </span>
                              <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${
                                candidate.confidence === "high"
                                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                  : candidate.confidence === "medium"
                                  ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                                  : "bg-muted text-muted-foreground border-border"
                              }`}>
                                {candidate.confidence}
                              </span>
                              {candidate.changeScore != null && (
                                <span className="text-[10px] text-muted-foreground">
                                  score: {candidate.changeScore.toFixed(3)}
                                </span>
                              )}
                              {candidate.reviewState !== "pending" && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {candidate.reviewState}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm font-mono">
                              <span>{fmtMs(startMs)}</span>
                              <span className="text-muted-foreground">→</span>
                              <span>{fmtMs(endMs)}</span>
                              {endMs != null && (
                                <span className="text-xs text-muted-foreground font-sans">
                                  ({fmtSec(endMs - startMs)})
                                </span>
                              )}
                            </div>
                            {nearest && (
                              <div className="rounded border border-border bg-muted/30 px-2 py-1 text-xs">
                                <span className="text-muted-foreground">Nearest canonical: </span>
                                <span className="text-foreground font-medium">{nearest.title ?? "Untitled"}</span>
                                <span className="text-muted-foreground ml-2 font-mono">
                                  {fmtMs(nearest.start_ms)} → {fmtMs(nearest.end_ms)}
                                </span>
                                <span className="text-muted-foreground ml-2">
                                  Δ {nearestDiff}ms
                                </span>
                              </div>
                            )}
                          </div>

                          {candidateThumb && (
                            <button type="button" onClick={() => { setSelectedCandidateId(candidate.candidateId); seekTo(startMs); }} className="shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={candidateThumb}
                                alt={`Candidate ${i + 1}`}
                                className="h-14 w-24 object-cover rounded border border-border hover:border-foreground/40 transition-colors"
                              />
                            </button>
                          )}
                        </div>

                        {/* Adjust form */}
                        {isAdjusting && (
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <label className="text-xs text-muted-foreground">
                              Start (ms)
                              <input type="number" value={adjustStart} onChange={(e) => setAdjustStart(Number(e.target.value))} className="border-input bg-background text-foreground mt-1 w-full rounded-md border px-2 py-1 text-sm" />
                            </label>
                            <label className="text-xs text-muted-foreground">
                              End (ms)
                              <input type="number" value={adjustEnd} onChange={(e) => setAdjustEnd(Number(e.target.value))} className="border-input bg-background text-foreground mt-1 w-full rounded-md border px-2 py-1 text-sm" />
                            </label>
                            <div className="col-span-2 flex gap-2">
                              <Button size="sm" onClick={() => { updateCandidate(adjustCandidate(candidate, adjustStart, adjustEnd)); setAdjustingId(null); }}>Apply</Button>
                              <Button size="sm" variant="outline" onClick={() => setAdjustingId(null)}>Cancel</Button>
                            </div>
                          </div>
                        )}

                        {/* Scene creation form */}
                        {isCreating && (
                          <div className="rounded border border-[var(--accent-mv)]/40 bg-[var(--accent-mv)]/5 px-3 py-3 space-y-2">
                            <p className="text-xs font-semibold text-foreground">Create canonical Scene</p>
                            <p className="text-[10px] text-muted-foreground">
                              This will create a permanent canonical Scene record: Master → CanonicalState → Projection → Binding.
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground font-mono">
                              <span>Start: {fmtMs(startMs)}</span>
                              <span>End: {fmtMs(endMs)}</span>
                            </div>
                            <input
                              type="text"
                              placeholder="Scene title (required)"
                              value={newSceneTitle}
                              onChange={(e) => setNewSceneTitle(e.target.value)}
                              className="border-input bg-background text-foreground w-full rounded-md border px-3 py-1.5 text-sm"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                disabled={createBusy || !newSceneTitle.trim()}
                                onClick={() => createScene(candidate)}
                              >
                                {createBusy ? "Creating…" : "Confirm — Create Scene"}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => { setCreatingFromId(null); setNewSceneTitle(""); }}>
                                Cancel
                              </Button>
                            </div>
                            {createMsg && (
                              <p className={`text-xs ${createMsg.startsWith("Error") ? "text-destructive" : "text-emerald-400"}`}>
                                {createMsg}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        {candidate.reviewState !== "rejected" && !isAdjusting && !isCreating && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button size="sm" variant="outline" onClick={() => { setSelectedCandidateId(candidate.candidateId); seekTo(startMs); }}>
                              Jump to {fmtMs(startMs)}
                            </Button>
                            {candidate.reviewState === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setCreatingFromId(candidate.candidateId);
                                    setSelectedCandidateId(candidate.candidateId);
                                    setNewSceneTitle("");
                                    setCreateMsg(null);
                                  }}
                                >
                                  Accept as Scene
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => { setAdjustingId(candidate.candidateId); setAdjustStart(startMs); setAdjustEnd(endMs ?? 0); }}>
                                  Adjust
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => updateCandidate(rejectCandidate(candidate))}>
                                  Reject
                                </Button>
                              </>
                            )}
                            {candidate.reviewState === "accepted" && (
                              <span className="text-xs text-emerald-400 self-center">Scene created ✓</span>
                            )}
                          </div>
                        )}
                        {candidate.reviewState === "rejected" && (
                          <Button size="sm" variant="outline" onClick={() => updateCandidate({ ...candidate, reviewState: "pending" })}>
                            Restore
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Global create message */}
          {createMsg && !creatingFromId && (
            <p className={`text-sm ${createMsg.startsWith("Error") ? "text-destructive" : "text-emerald-400"}`}>
              {createMsg}
            </p>
          )}

          {/* Operator notice */}
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Operator Decision</p>
            <p className="text-xs text-muted-foreground">
              Evidence candidates are not canonical. Scenes are only created when you explicitly confirm via "Accept as Scene".
              No canonical state is modified by inspection or candidate review alone.
            </p>
          </div>

        </div>
      )}
    </div>
  );
}

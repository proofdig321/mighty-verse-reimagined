"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  rejectCandidate,
  adjustCandidate,
  effectiveBoundary,
  type SceneCandidate,
} from "@/lib/media/scene-candidates";
import {
  composeSceneTitle,
  SCENE_STRUCTURE_ROLES,
  type SceneStructureRoleId,
} from "@/lib/media/scene-structure";
import { CURATE_NEAREST_SCENE_MS, nearestCanonicalScene } from "@/lib/media/inspect-scope";
import type {
  CurateMural,
  CurateScene,
  CurateAsset,
} from "@/lib/assemble/load-curate-inspection";
import { galleryMediaLabel } from "@/lib/assemble/gallery-source";

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

function StructureSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: SceneStructureRoleId;
  onChange: (value: SceneStructureRoleId) => void;
}) {
  return (
    <label className="text-xs text-muted-foreground block">
      Structure
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as SceneStructureRoleId)}
        className="border-input bg-background text-foreground mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
      >
        {SCENE_STRUCTURE_ROLES.map((role) => (
          <option key={role.id} value={role.id}>
            {role.label}
          </option>
        ))}
      </select>
    </label>
  );
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
  universeId: string;
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
  universeId,
  mural,
  scenes: initialScenes,
  availableAssets,
}: Props) {

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
  const [newSceneRole, setNewSceneRole] = useState<SceneStructureRoleId>("intro");
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [manualRole, setManualRole] = useState<SceneStructureRoleId>("intro");
  const [manualTitle, setManualTitle] = useState("");
  const [manualStart, setManualStart] = useState(0);
  const [manualEnd, setManualEnd] = useState(0);
  const [retainMsg, setRetainMsg] = useState<string | null>(null);
  const [retainBusy, setRetainBusy] = useState(false);

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
      const duration = Math.round(video.duration * 1000);
      setDurationMs(duration);
      setMetadata(extractBrowserMetadata(video));
      setPlayerReady(true);
      setManualEnd((current) => current || duration);
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
  async function submitScene(opts: {
    title: string;
    startMs: number;
    endMs: number;
    candidate?: SceneCandidate;
  }) {
    if (!mural) return;
    const assetId = mural.asset_id;
    if (!assetId) { setCreateMsg("Mural has no media asset bound."); return; }
    if (!opts.title.trim()) { setCreateMsg("Scene title is required."); return; }
    if (opts.endMs <= opts.startMs) { setCreateMsg("End must be after start."); return; }

    setCreateBusy(true);
    setCreateMsg(null);
    const res = await api("/api/authority/scenes", {
      mural_master_id: mural.master_id,
      title: opts.title.trim(),
      start_ms: opts.startMs,
      end_ms: opts.endMs,
      asset_id: assetId,
    });
    setCreateBusy(false);
    if (!res.ok) {
      setCreateMsg(`Error: ${res.error}`);
      return;
    }
    setScenes((prev) => [
      ...prev,
      {
        master_id: res.master_id,
        title: opts.title.trim(),
        sort_order: null,
        start_ms: opts.startMs,
        end_ms: opts.endMs,
        projection_id: res.projection_id,
        asset_id: assetId,
      },
    ]);
    if (opts.candidate) updateCandidate({ ...opts.candidate, reviewState: "accepted" });
    setCreatingFromId(null);
    setNewSceneTitle("");
    setCreateMsg(`Scene "${opts.title.trim()}" created.`);
  }

  async function createScene(candidate: SceneCandidate) {
    const { startMs, endMs } = effectiveBoundary(candidate);
    const title = composeSceneTitle(newSceneRole, newSceneTitle);
    await submitScene({
      title,
      startMs,
      endMs: endMs ?? startMs + 1000,
      candidate,
    });
  }

  async function createManualScene() {
    const title = composeSceneTitle(manualRole, manualTitle);
    await submitScene({
      title,
      startMs: manualStart,
      endMs: manualEnd || (effectiveDuration || manualStart + 1000),
    });
  }

  async function keepStill(timeMs: number) {
    if (!mural?.asset_id) {
      setRetainMsg("Mural has no media asset bound.");
      return;
    }
    setRetainBusy(true);
    setRetainMsg(null);
    const res = await api("/api/authority/references", {
      universe_id: universeId,
      source_asset_id: mural.asset_id,
      time_ms: timeMs,
      role: "still",
    });
    setRetainBusy(false);
    setRetainMsg(res.ok
      ? res.already
        ? "That still is already a curated reference."
        : "Kept as a production reference."
      : `Error: ${res.error ?? "Reference could not be retained."}`);
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


  return (
    <div className="space-y-6">
      {mural && (
        <p className="text-sm text-muted-foreground">
          Mural: {mural.title ?? "Untitled"} ·{" "}
          {mural.provider === "mux" ? "Mux HLS" : mural.provider ?? "No media"} ·{" "}
          {mural.duration_ms ? fmtSec(mural.duration_ms) : "—"}
        </p>
      )}

      {!mural && (
        <p className="text-sm text-muted-foreground rounded-lg border border-border bg-card/30 px-5 py-6">
          This Universe has no Mural yet. Media inspection needs mural-bound media. Creative Suite is still the assembly environment.
        </p>
      )}

      {mural && (
        <>

          {/* Mural asset binding */}
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
                        {galleryMediaLabel({ title: a.title })} · {a.duration_ms ? fmtSec(a.duration_ms) : "—"}
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

          <Card data-establish-window="manual">
            <CardContent className="pt-4 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Establish a Scene window
              </p>
              <p className="text-xs text-muted-foreground">
                Visual inspection proposes candidates. You name the window (Intro, Verse 1, Hook…) and set start/end.
                This creates a canonical Scene. Sentinel does not invent musical structure.
              </p>
              <StructureSelect id="manual-structure" value={manualRole} onChange={setManualRole} />
              <input
                type="text"
                placeholder="Optional title (e.g. Worldwide Studios)"
                value={manualTitle}
                onChange={(event) => setManualTitle(event.target.value)}
                className="border-input bg-background text-foreground w-full rounded-md border px-3 py-1.5 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted-foreground">
                  Start (ms)
                  <input
                    type="number"
                    value={manualStart}
                    onChange={(event) => setManualStart(Number(event.target.value))}
                    className="border-input bg-background text-foreground mt-1 w-full rounded-md border px-2 py-1 text-sm"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  End (ms)
                  <input
                    type="number"
                    value={manualEnd}
                    onChange={(event) => setManualEnd(Number(event.target.value))}
                    className="border-input bg-background text-foreground mt-1 w-full rounded-md border px-2 py-1 text-sm"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" type="button" onClick={() => setManualStart(currentMs)}>
                  Playhead → start
                </Button>
                <Button size="sm" variant="outline" type="button" onClick={() => setManualEnd(currentMs || effectiveDuration)}>
                  Playhead → end
                </Button>
                <Button size="sm" variant="outline" type="button" disabled={retainBusy} onClick={() => void keepStill(currentMs)}>
                  {retainBusy ? "Keeping…" : "Keep still as reference"}
                </Button>
                <Button
                  size="sm"
                  disabled={createBusy || !mural?.asset_id}
                  onClick={() => void createManualScene()}
                >
                  {createBusy ? "Creating…" : `Create ${composeSceneTitle(manualRole, manualTitle)}`}
                </Button>
              </div>
              {retainMsg ? <p className="text-xs text-muted-foreground">{retainMsg}</p> : null}
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

                  const nearestMatch = nearestCanonicalScene(scenes, startMs, CURATE_NEAREST_SCENE_MS);
                  const nearest = nearestMatch?.scene ?? null;
                  const nearestDiff = nearestMatch?.deltaMs ?? Infinity;

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
                              Pick the editorial structure. Do not leave Sentinel to guess verse vs hook.
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground font-mono">
                              <span>Start: {fmtMs(startMs)}</span>
                              <span>End: {fmtMs(endMs)}</span>
                            </div>
                            <StructureSelect id={`structure-${candidate.candidateId}`} value={newSceneRole} onChange={setNewSceneRole} />
                            <input
                              type="text"
                              placeholder="Optional title"
                              value={newSceneTitle}
                              onChange={(e) => setNewSceneTitle(e.target.value)}
                              className="border-input bg-background text-foreground w-full rounded-md border px-3 py-1.5 text-sm"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                disabled={createBusy || (newSceneRole === "other" && !newSceneTitle.trim())}
                                onClick={() => void createScene(candidate)}
                              >
                                {createBusy ? "Creating…" : `Confirm — ${composeSceneTitle(newSceneRole, newSceneTitle)}`}
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
                                <Button size="sm" variant="outline" disabled={retainBusy} onClick={() => void keepStill(startMs)}>
                                  Keep still
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
              Evidence candidates are not canonical. Scenes are only created when you explicitly confirm via &quot;Accept as Scene&quot;.
              No canonical state is modified by inspection or candidate review alone.
            </p>
          </div>

        </>
      )}
    </div>
  );
}

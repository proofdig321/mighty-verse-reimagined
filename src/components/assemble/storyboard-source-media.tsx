"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { StoryboardHlsPreview } from "./storyboard-hls-preview";
import { formatTimestamp, sourceCategoryLabel, type StoryboardSourceRecord, type StoryboardFrameRecord } from "@/lib/storyboard/source";
import { muxThumbnailUrl } from "@/lib/media/thumbnail";
import { SecondsField } from "./seconds-field";
import type { CinematicShot } from "@/lib/media/cinematic-evidence";
import type { GallerySource } from "@/lib/assemble/gallery-source";
import { GallerySourcePicker } from "./gallery-source-picker";

type SourceTab = "upload" | "gallery" | "sentinel" | "url";

type GalleryRef = { asset_id: string; title: string; still_url: string | null };

export function StoryboardSourceMedia({
  workId,
  sources,
  frames,
  selectedPanelId,
  references = [],
  gallerySources = [],
  sentinelShots = [],
  onWork,
}: {
  workId: string | null;
  sources: StoryboardSourceRecord[];
  frames: StoryboardFrameRecord[];
  selectedPanelId: string | null;
  references?: GalleryRef[];
  gallerySources?: GallerySource[];
  sentinelShots?: CinematicShot[];
  onWork: (work: unknown) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<SourceTab>("upload");
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [assetId, setAssetId] = useState("");
  const [timeMs, setTimeMs] = useState(0);
  const [title, setTitle] = useState("");
  const active = sources[0] ?? null;

  async function attachAsset(nextAssetId: string, nextTitle: string) {
    if (!workId) return;
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "attach-source", work_id: workId, asset_id: nextAssetId, title: nextTitle }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error ?? "Source could not be attached.");
      setPhase("failed");
      return;
    }
    onWork(payload.work);
    setPhase("ready");
  }

  async function pollSession(sessionId: string, nextTitle: string) {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const response = await fetch(`/api/authority/media/upload-session/${sessionId}`);
      const payload = await response.json().catch(() => ({}));
      setPhase(payload.phase ?? "processing");
      if (payload.asset_id && (payload.phase === "ingested" || payload.phase === "ready" || payload.outcome === "ingested")) {
        await attachAsset(payload.asset_id, nextTitle);
        return;
      }
      if (payload.phase === "failed" || payload.outcome === "failed") {
        setError(payload.provider_error ?? payload.error ?? "Mux could not ingest this file.");
        setPhase("failed");
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }
    setError("Mux is still processing. Continue editing; refresh this source later.");
  }

  async function uploadFile(file: File) {
    if (!workId) {
      setError("Save the storyboard work before adding source media.");
      return;
    }
    setError(null);
    setPhase("uploading");
    setProgress(0);
    const sessionRes = await fetch("/api/authority/storyboard/source", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ work_id: workId, name: file.name }),
    });
    const session = await sessionRes.json().catch(() => ({}));
    if (!sessionRes.ok || !session.upload_url || !session.session_id) {
      setError(session.error ?? "Could not create a Mux direct upload.");
      setPhase("failed");
      return;
    }
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", session.upload_url);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
        xhr.onerror = () => reject(new Error("Upload failed."));
        xhr.send(file);
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
      setPhase("failed");
      return;
    }
    setPhase("processing");
    await pollSession(session.session_id, title || file.name);
  }

  async function ingestUrl() {
    if (!workId) return;
    setError(null);
    setPhase("processing");
    const response = await fetch("/api/authority/media/ingest-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, name: title || url }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.session_id) {
      setError(payload.error ?? "URL ingest failed.");
      setPhase("failed");
      return;
    }
    await pollSession(payload.session_id, title || url);
  }

  async function deriveFrame() {
    if (!workId || !active?.playback_id) return;
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "derive-frame",
        work_id: workId,
        playback_id: active.playback_id,
        timestamp_ms: timeMs,
        source_title: active.title,
        panel_id: selectedPanelId,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error ?? "Frame reference could not be created.");
      return;
    }
    onWork(payload.work);
  }

  return (
    <div className="space-y-4" data-storyboard-source="true">
      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Add source media</p>
        <p className="text-xs text-muted-foreground">Source is a Storyboard artifact. It does not become a canonical Scene.</p>

        {/* Source mode tabs */}
        <div className="flex gap-1 flex-wrap">
          {(["upload", "gallery", "sentinel", "url"] as SourceTab[]).map((t) => (
            <button key={t} type="button"
              onClick={() => setTab(t)}
              className={cn(
                "px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-[0.12em] border transition-colors",
                tab === t
                  ? "border-primary text-primary bg-primary/5"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}>
              {t === "upload" ? "Local Upload" : t === "gallery" ? `Gallery${gallerySources.length ? ` (${gallerySources.length})` : references.length ? ` (${references.length})` : ""}` : t === "sentinel" ? `Sentinel${sentinelShots.length ? ` (${sentinelShots.length})` : ""}` : "URL / Asset ID"}
            </button>
          ))}
        </div>

        {/* Upload tab */}
        {tab === "upload" && (
          <div className="space-y-2">
            <Label htmlFor="source-title">Source title</Label>
            <Input id="source-title" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Name this source. Do not invent a broadcast title." />
            <input ref={fileRef} type="file" accept="video/*,image/*" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFile(file);
            }} />
            <Button type="button" size="sm" onClick={() => fileRef.current?.click()}>Upload local file</Button>
          </div>
        )}

        {/* Gallery tab — global media catalogue or universe references */}
        {tab === "gallery" && (
          <div className="space-y-2">
            {gallerySources.length > 0 ? (
              <GallerySourcePicker
                sources={gallerySources}
                selectedId={null}
                onSelect={(id) => {
                  const source = gallerySources.find((s) => s.asset_id === id);
                  if (source) void attachAsset(source.asset_id, source.title ?? "Gallery media");
                }}
                label="Select from gallery"
              />
            ) : references.length > 0 ? (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {references.map((ref) => (
                  <li key={ref.asset_id}>
                    <button type="button"
                      className="w-full space-y-1 text-left group"
                      onClick={() => void attachAsset(ref.asset_id, ref.title)}>
                      <div className="aspect-video w-full rounded overflow-hidden bg-muted/40 border border-border group-hover:border-primary/50 transition-colors">
                        {ref.still_url
                          ? <img src={ref.still_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{ref.title}</p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground/60">No media in the gallery yet. Upload or ingest media first.</p>
            )}
          </div>
        )}

        {/* Sentinel tab — cinematic evidence shots */}
        {tab === "sentinel" && (
          <div className="space-y-2">
            {sentinelShots.length === 0 ? (
              <p className="text-xs text-muted-foreground/60">No Sentinel evidence yet. Run Sentinel analysis on source media first.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {sentinelShots.map((shot) => (
                  <li key={shot.shot_id}>
                    <button type="button"
                      className="w-full space-y-1 text-left group"
                      onClick={() => {
                        if (!workId) return;
                        void (async () => {
                          const response = await fetch("/api/authority/storyboard", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              action: "select-sentinel-shot",
                              work_id: workId,
                              shot,
                            }),
                          });
                          const payload = await response.json().catch(() => ({}));
                          if (response.ok) onWork(payload.work);
                          else setError(payload.error ?? "Could not attach Sentinel shot.");
                        })();
                      }}>
                      <div className="aspect-video w-full rounded overflow-hidden bg-muted/40 border border-border group-hover:border-primary/50 transition-colors">
                        {shot.still_url
                          ? <img src={shot.still_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        Shot {String(shot.sequence).padStart(2, "0")} · {formatTimestamp(shot.time_ms)}
                      </p>
                      {shot.what_happens && (
                        <p className="text-[9px] text-muted-foreground/60 truncate">{shot.what_happens}</p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* URL / Asset ID tab */}
        {tab === "url" && (
          <div className="space-y-2">
            <Label htmlFor="source-title-url">Source title</Label>
            <Input id="source-title-url" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Name this source." />
            <Input placeholder="https://… media file URL" value={url} onChange={(e) => setUrl(e.target.value)} />
            <Input placeholder="Existing media asset ID" value={assetId} onChange={(e) => setAssetId(e.target.value)} />
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void ingestUrl()} disabled={!url.trim()}>Add URL</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void attachAsset(assetId, title)} disabled={!assetId.trim()}>Attach asset</Button>
            </div>
          </div>
        )}

        {phase !== "idle" ? (
          <p className="text-xs text-muted-foreground" data-source-phase={phase}>
            {phase === "uploading" ? `Uploading… ${progress}%` : phase === "processing" ? "Processing…" : phase === "ready" ? "Source attached. It is not a Scene." : phase}
          </p>
        ) : null}
        {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      </div>

      {active?.endpoint_ref || active?.playback_id ? (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {sourceCategoryLabel(active.category)} · inspect
          </p>
          <StoryboardHlsPreview
            endpoint={active.endpoint_ref ?? `https://stream.mux.com/${active.playback_id}.m3u8`}
            poster={active.still_url}
            label={active.title}
            onTimeUpdate={setTimeMs}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <SecondsField label="Source window" valueMs={timeMs} onChange={setTimeMs} />
            <p className="self-end text-xs text-muted-foreground">
              {formatTimestamp(timeMs)}
              {active.duration_ms ? ` / ${formatTimestamp(active.duration_ms)}` : ""}
            </p>
          </div>
          {active.playback_id ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={muxThumbnailUrl(active.playback_id, timeMs / 1000, 640)} alt="" className="aspect-video w-full rounded object-cover" />
          ) : null}
          <Button type="button" size="sm" onClick={() => void deriveFrame()}>
            Use this moment as a panel reference
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Source: {active.title}. Timestamp: {formatTimestamp(timeMs)}. Derived: Storyboard Reference. Not a Scene.
          </p>
        </div>
      ) : null}

      {frames.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {frames.map((frame) => (
            <li key={`${frame.still_url}-${frame.timestamp_ms}`} className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={frame.still_url} alt="" className="aspect-video w-full rounded object-cover" />
              <p className="text-[11px] text-muted-foreground">{frame.source_title} · {formatTimestamp(frame.timestamp_ms)}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

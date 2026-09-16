"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StoryboardHlsPreview } from "./storyboard-hls-preview";
import { formatTimestamp, sourceCategoryLabel, type StoryboardSourceRecord, type StoryboardFrameRecord } from "@/lib/storyboard/source";
import { muxThumbnailUrl } from "@/lib/media/thumbnail";

export function StoryboardSourceMedia({
  workId,
  sources,
  frames,
  selectedPanelId,
  onWork,
}: {
  workId: string | null;
  sources: StoryboardSourceRecord[];
  frames: StoryboardFrameRecord[];
  selectedPanelId: string | null;
  onWork: (work: unknown) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [assetId, setAssetId] = useState("");
  const [timeMs, setTimeMs] = useState(0);
  const [title, setTitle] = useState("Super Hero Ego SABC1 Performance");
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
    }).catch((caught) => {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
      setPhase("failed");
    });
    if (phase === "failed") return;
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
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Add source media</p>
        <p className="text-xs text-muted-foreground">
          Source video is a Storyboard artifact. It does not become a canonical Scene.
        </p>
        <Label htmlFor="source-title">Source title</Label>
        <Input id="source-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadFile(file);
          }} />
          <Button type="button" size="sm" onClick={() => fileRef.current?.click()}>Upload local video</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void ingestUrl()} disabled={!url.trim()}>Add direct media URL</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void attachAsset(assetId, title)} disabled={!assetId.trim()}>Add existing Mux asset</Button>
        </div>
        <Input placeholder="https://… media file or YouTube URL" value={url} onChange={(event) => setUrl(event.target.value)} />
        <Input placeholder="Existing media asset id" value={assetId} onChange={(event) => setAssetId(event.target.value)} />
        {phase !== "idle" ? (
          <p className="text-xs text-muted-foreground" data-source-phase={phase}>
            {phase === "uploading" ? `Uploading… ${progress}%` : phase === "processing" ? "Mux is processing the source." : phase === "ready" ? "Source attached. It is not a Scene." : phase}
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
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs">
              Timestamp (ms)
              <Input type="number" min={0} value={timeMs} onChange={(event) => setTimeMs(Number(event.target.value) || 0)} />
            </label>
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

"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { HierarchyBreadcrumb } from "./breadcrumb";
import { StoryboardHlsPreview } from "./storyboard-hls-preview";
import { GallerySourcePicker } from "./gallery-source-picker";
import { SecondsField } from "./seconds-field";
import {
  formatTimestamp,
  sourceCategoryLabel,
  type StoryboardSourceRecord,
  type StoryboardFrameRecord,
} from "@/lib/storyboard/source";
import { muxThumbnailUrl } from "@/lib/media/thumbnail";
import type { GallerySource } from "@/lib/assemble/gallery-source";

type SourceTab = "upload" | "gallery" | "url";

/**
 * WorkSourceWorkflow — the dedicated source selection workflow.
 *
 * This is a route-level component, not a tab inside a larger surface.
 * It owns source attachment, upload, URL ingest, and frame derivation.
 * It does not own generation, Sentinel, or assembly.
 *
 * Reusable: can be composed by Storyboard, 2.5D, Holographic, or any
 * other workflow that needs source media selection.
 */
export function WorkSourceWorkflow({
  workId,
  workTitle,
  sources,
  frames,
  gallerySources = [],
  returnHref,
  fromHref,
}: {
  workId: string;
  workTitle: string;
  sources: StoryboardSourceRecord[];
  frames: StoryboardFrameRecord[];
  gallerySources?: GallerySource[];
  /** Where to go after source is selected / confirmed. */
  returnHref: string;
  /** Where the user came from (e.g. gallery mediaId). */
  fromHref?: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<SourceTab>("upload");
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [assetId, setAssetId] = useState("");
  const [timeMs, setTimeMs] = useState(0);
  const [title, setTitle] = useState("");
  const [localSources, setLocalSources] = useState<StoryboardSourceRecord[]>(sources);
  const [localFrames, setLocalFrames] = useState<StoryboardFrameRecord[]>(frames);

  const active = localSources[0] ?? null;

  function onWork(work: unknown) {
    const w = work as { sources?: StoryboardSourceRecord[]; frames?: StoryboardFrameRecord[] };
    if (w.sources) setLocalSources(w.sources);
    if (w.frames) setLocalFrames(w.frames);
  }

  async function attachAsset(nextAssetId: string, nextTitle: string) {
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
    if (!active?.playback_id) return;
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "derive-frame",
        work_id: workId,
        playback_id: active.playback_id,
        timestamp_ms: timeMs,
        source_title: active.title,
        panel_id: null,
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
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <div className="border-b border-border/50 bg-card/20">
        <div className="mx-auto max-w-4xl px-6 py-3 flex items-center gap-3">
          <HierarchyBreadcrumb
            items={[
              { label: "Studio", href: "/studio" },
              { label: "Work", href: "/studio/work" },
              { label: workTitle, href: returnHref },
              { label: "Source" },
            ]}
          />
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Link
              href={returnHref}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft size={14} />
              Back to work
            </Link>
            {fromHref && (
              <Link
                href={fromHref}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft size={14} />
                Back to gallery
              </Link>
            )}
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Source · {workTitle}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display, inherit)" }}>
            Choose Source Media
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Source is a Storyboard artifact. It does not become a canonical Scene.
          </p>
        </div>

        {/* Active source — shown prominently when one exists */}
        {active && (
          <div className="rounded-xl border border-border bg-card/50 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {sourceCategoryLabel(active.category)} · Active source
                </p>
                <p className="text-base font-medium text-foreground mt-0.5">{active.title}</p>
              </div>
              <Link
                href={returnHref}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
                  "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                )}
              >
                Use this source →
              </Link>
            </div>

            {(active.endpoint_ref || active.playback_id) && (
              <>
                <StoryboardHlsPreview
                  endpoint={active.endpoint_ref ?? `https://stream.mux.com/${active.playback_id}.m3u8`}
                  poster={active.still_url}
                  label={active.title}
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
                  <img
                    src={muxThumbnailUrl(active.playback_id, timeMs / 1000, 640)}
                    alt=""
                    className="aspect-video w-full rounded object-cover"
                  />
                ) : null}
                <Button type="button" size="sm" onClick={() => void deriveFrame()}>
                  Use this moment as a panel reference
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Source: {active.title}. Timestamp: {formatTimestamp(timeMs)}. Derived: Storyboard Reference. Not a Scene.
                </p>
              </>
            )}
          </div>
        )}

        {/* Derived frames */}
        {localFrames.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Derived frames
            </p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {localFrames.map((frame) => (
                <li key={`${frame.still_url}-${frame.timestamp_ms}`} className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={frame.still_url} alt="" className="aspect-video w-full rounded object-cover" />
                  <p className="text-[11px] text-muted-foreground">
                    {frame.source_title} · {formatTimestamp(frame.timestamp_ms)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Add / replace source */}
        <div className="space-y-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {active ? "Replace source" : "Add source"}
          </p>

          {/* Source mode tabs */}
          <div className="flex gap-1 flex-wrap">
            {(["upload", "gallery", "url"] as SourceTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-[0.12em] border transition-colors",
                  tab === t
                    ? "border-primary text-primary bg-primary/5"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "upload"
                  ? "Local Upload"
                  : t === "gallery"
                  ? `Gallery${gallerySources.length ? ` (${gallerySources.length})` : ""}`
                  : "URL / Asset ID"}
              </button>
            ))}
          </div>

          {/* Upload */}
          {tab === "upload" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="source-title">Source title</Label>
                <Input
                  id="source-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Name this source. Do not invent a broadcast title."
                />
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="video/*,image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadFile(file);
                }}
              />
              <Button type="button" size="sm" onClick={() => fileRef.current?.click()}>
                Upload local file
              </Button>
            </div>
          )}

          {/* Gallery */}
          {tab === "gallery" && (
            <div className="space-y-2">
              {gallerySources.length > 0 ? (
                <GallerySourcePicker
                  sources={gallerySources}
                  selectedId={active?.asset_id ?? null}
                  onSelect={(id) => {
                    const source = gallerySources.find((s) => s.asset_id === id);
                    if (source) void attachAsset(source.asset_id, source.title ?? "Gallery media");
                  }}
                  label="Select from gallery"
                />
              ) : (
                <p className="text-xs text-muted-foreground/60">
                  No playable gallery media yet.{" "}
                  <Link href="/gallery" className="text-primary hover:underline">
                    Browse the gallery
                  </Link>{" "}
                  to find media.
                </p>
              )}
            </div>
          )}

          {/* URL / Asset ID */}
          {tab === "url" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="source-title-url">Source title</Label>
                <Input
                  id="source-title-url"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Name this source."
                />
              </div>
              <Input
                placeholder="https://… media file URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Input
                placeholder="Existing media asset ID"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void ingestUrl()}
                  disabled={!url.trim()}
                >
                  Add URL
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void attachAsset(assetId, title)}
                  disabled={!assetId.trim()}
                >
                  Attach asset
                </Button>
              </div>
            </div>
          )}

          {phase !== "idle" ? (
            <p className="text-xs text-muted-foreground" data-source-phase={phase}>
              {phase === "uploading"
                ? `Uploading… ${progress}%`
                : phase === "processing"
                ? "Processing…"
                : phase === "ready"
                ? "Source attached. It is not a Scene."
                : phase}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        {/* Confirm / return */}
        <div className="flex items-center gap-3 pt-2 border-t border-border/40">
          <Button
            type="button"
            onClick={() => router.push(returnHref)}
          >
            {active ? "Continue with this source" : "Continue without source"}
          </Button>
          <Link
            href={returnHref}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type ThumbnailPickerTab = "url" | "upload" | "timeline";

type Props = {
  /** Current saved URL (shown as preview) */
  currentUrl?: string | null;
  /** Mux playback ID — enables the Timeline tab */
  muxPlaybackId?: string | null;
  /** Duration of the source in ms — used to clamp the scrubber */
  durationMs?: number | null;
  /** Called with the resolved HTTPS URL when the user confirms */
  onPick: (url: string) => void;
  onCancel: () => void;
  busy?: boolean;
  label?: string;
};

function muxThumbUrl(playbackId: string, timeSec: number) {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${timeSec}&width=640`;
}

export function ThumbnailPicker({
  currentUrl,
  muxPlaybackId,
  durationMs,
  onPick,
  onCancel,
  busy = false,
  label = "thumbnail",
}: Props) {
  const tabs: ThumbnailPickerTab[] = muxPlaybackId
    ? ["url", "upload", "timeline"]
    : ["url", "upload"];

  const [tab, setTab] = useState<ThumbnailPickerTab>("url");
  const urlId = useId();
  const fileId = useId();

  // URL tab
  const [urlValue, setUrlValue] = useState(currentUrl ?? "");
  const [urlError, setUrlError] = useState<string | null>(null);

  // Upload tab
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  // Timeline tab
  const durationSec = durationMs ? Math.floor(durationMs / 1000) : 300;
  const [timeSec, setTimeSec] = useState(0);
  const previewUrl = muxPlaybackId ? muxThumbUrl(muxPlaybackId, timeSec) : null;

  function validateUrl(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return "A URL is required.";
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "https:") return "URL must use HTTPS.";
      return null;
    } catch {
      return "Enter a valid HTTPS URL.";
    }
  }

  function handleUrlSubmit() {
    const err = validateUrl(urlValue);
    if (err) { setUrlError(err); return; }
    setUrlError(null);
    onPick(urlValue.trim());
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setUploadError("Choose a file first."); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadError("Only JPEG, PNG, or WebP accepted.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File must be under 10 MB.");
      return;
    }
    setUploadError(null);
    setUploadBusy(true);
    setUploadStatus("Requesting upload URL…");
    try {
      const res = await fetch("/api/authority/media/thumbnail-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, content_type: file.type, size: file.size }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Upload URL failed.");

      setUploadStatus("Uploading…");
      const put = await fetch(payload.signed_url, {
        method: "PUT",
        headers: { "Content-Type": file.type, "x-upsert": "true" },
        body: file,
      });
      if (!put.ok) throw new Error("Upload failed. Try again.");

      setUploadStatus("Uploaded.");
      onPick(payload.public_url as string);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
      setUploadStatus(null);
    } finally {
      setUploadBusy(false);
    }
  }

  const tabLabel: Record<ThumbnailPickerTab, string> = {
    url: "URL",
    upload: "Upload",
    timeline: "Timeline",
  };

  return (
    <div className="thumbnail-picker">
      <div className="thumbnail-picker-tabs" role="tablist" aria-label={`Set ${label}`}>
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={cn("thumbnail-picker-tab", tab === t && "is-active")}
            onClick={() => setTab(t)}
          >
            {tabLabel[t]}
          </button>
        ))}
      </div>

      {tab === "url" && (
        <div className="thumbnail-picker-body">
          <Label htmlFor={urlId} className="text-xs">HTTPS image URL</Label>
          <Input
            id={urlId}
            value={urlValue}
            onChange={(e) => { setUrlValue(e.target.value); setUrlError(null); }}
            placeholder="https://image.mux.com/…/thumbnail.jpg"
            disabled={busy}
            autoComplete="off"
            aria-invalid={urlError ? true : undefined}
          />
          {urlError && <p role="alert" className="text-xs text-destructive">{urlError}</p>}
          {urlValue && !urlError && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urlValue} alt="" className="thumbnail-picker-preview" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <div className="thumbnail-picker-actions">
            <Button type="button" size="sm" disabled={busy} onClick={handleUrlSubmit}>Use URL</Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
          </div>
        </div>
      )}

      {tab === "upload" && (
        <div className="thumbnail-picker-body">
          <Label htmlFor={fileId} className="text-xs">Image file (JPEG, PNG, WebP · max 10 MB)</Label>
          <Input
            id={fileId}
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy || uploadBusy}
            className="cursor-pointer"
          />
          {uploadError && <p role="alert" className="text-xs text-destructive">{uploadError}</p>}
          {uploadStatus && <p role="status" className="text-xs text-muted-foreground">{uploadStatus}</p>}
          <div className="thumbnail-picker-actions">
            <Button type="button" size="sm" disabled={busy || uploadBusy} onClick={() => void handleUpload()}>
              {uploadBusy ? "Uploading…" : "Upload"}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy || uploadBusy} onClick={onCancel}>Cancel</Button>
          </div>
        </div>
      )}

      {tab === "timeline" && muxPlaybackId && (
        <div className="thumbnail-picker-body">
          <Label className="text-xs">Scrub to frame — {timeSec}s</Label>
          <input
            type="range"
            min={0}
            max={durationSec}
            step={1}
            value={timeSec}
            onChange={(e) => setTimeSec(Number(e.target.value))}
            className="w-full accent-primary"
            aria-label="Timeline position"
          />
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={`Frame at ${timeSec}s`} className="thumbnail-picker-preview" />
          )}
          <div className="thumbnail-picker-actions">
            <Button type="button" size="sm" disabled={busy} onClick={() => previewUrl && onPick(previewUrl)}>
              Use this frame
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

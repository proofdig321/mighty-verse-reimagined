"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type AuthorityData = {
  authority: { authority_id: string; authority_type: string; scope_type: string; capabilities: string[] };
  masters: { master_id: string; canonical_type: string; current_state_id: string | null; created_at: string }[];
  states: { canonical_state_id: string; master_id: string; version: number; authorisation_state: string; integrity_hash: string; created_at: string }[];
  projections: { projection_id: string; canonical_state_id: string; master_id: string; projection_type: string; collectible_designated: boolean; integrity_hash: string; created_at: string }[];
  bindings: { binding_id: string; projection_id: string; binding_type: string; access_level: string; asset_id: string; start_ms: number | null; end_ms: number | null; realization_id: string | null; media_asset: { storage_ref: string; asset_type: string; rights_holder_ref: string | null; rights_basis: string | null } | null }[];
  presentations: { master_id: string; title: string; description: string | null; artwork_asset_id: string | null; artwork_asset: { storage_ref: string } | null }[];
  projectionPresentations: { projection_id: string; title: string; description: string | null; artwork_asset_id: string | null; artwork_asset: { storage_ref: string } | null }[];
  realizations: { realization_id: string; master_id: string; realization_type: string; rights_holder_ref: string | null; rights_basis: string | null; production_notes: string | null }[];
};

const WORK_TYPE_LABELS: Record<string, string> = {
  "universe": "Universe",
  "creative-moment": "Creative Moment",
  "mural": "Mural",
  "interpretation": "Interpretation",
  "other": "Other",
};

const EXPERIENCE_TYPE_LABELS: Record<string, string> = {
  "experiential": "Experiential",
  "distributional": "Distributional",
  "archival": "Archival",
  "other": "Other",
};

const CANONICAL_TYPES = ["universe", "creative-moment", "mural", "interpretation", "other"] as const;
const PROJECTION_TYPES = ["experiential", "distributional", "archival", "other"] as const;

function shortId(id: string) { return id.slice(0, 8); }

type WorkStatus = {
  ready: boolean;
  needs: string;
  hasState: boolean;
  hasExperience: boolean;
  hasMedia: boolean;
  playable: boolean;
  hasArtwork: boolean;
  needsTimeline: boolean;
  hasRealization: boolean;
  rightsVerified: boolean;
};

type WorkRecord = {
  master: AuthorityData["masters"][number];
  state: AuthorityData["states"][number] | undefined;
  projection: AuthorityData["projections"][number] | undefined;
  binding: AuthorityData["bindings"][number] | undefined;
  presentation: AuthorityData["presentations"][number] | undefined;
  projectionPresentation: AuthorityData["projectionPresentations"][number] | undefined;
  status: WorkStatus;
};

function getWorkStatus(
  master: AuthorityData["masters"][number],
  state: AuthorityData["states"][number] | undefined,
  projection: AuthorityData["projections"][number] | undefined,
  binding: AuthorityData["bindings"][number] | undefined,
  presentation: AuthorityData["presentations"][number] | undefined,
  projectionPresentation: AuthorityData["projectionPresentations"][number] | undefined,
  realizations: AuthorityData["realizations"]
): WorkStatus {
  const hasState = !!state;
  const hasExperience = !!projection;
  const hasMedia = !!binding;
  const playable = !!binding?.media_asset?.storage_ref && !binding.media_asset.storage_ref.startsWith("seed:placeholder:");
  const hasArtwork = !!(presentation?.artwork_asset_id || projectionPresentation?.artwork_asset_id);
  const needsTimeline = master.canonical_type === "scene";
  const hasTimeline = !needsTimeline || (binding?.start_ms != null && binding?.end_ms != null);
  const realization = realizations.find(item => item.realization_id === binding?.realization_id || item.master_id === master.master_id);
  const hasRealization = !!realization;
  const rightsVerified = !!binding?.media_asset?.rights_holder_ref && !!binding.media_asset.rights_basis;
  // Artwork, realization, and rights are surfaced as operational context. They
  // are not universal blockers: the operating requirement is determined by the
  // kind of work and the experience it is meant to deliver.
  const needs = !hasState
    ? "Needs authorisation"
    : !hasExperience
    ? "Needs experience"
    : !hasMedia || !playable
    ? "Needs media"
    : !hasTimeline
    ? "Needs timeline"
    : "Ready";
  return { ready: needs === "Ready", needs, hasState, hasExperience, hasMedia, playable, hasArtwork, needsTimeline: !hasTimeline, hasRealization, rightsVerified };
}

function isOfficialAnimation(master: AuthorityData["masters"][number], presentation: AuthorityData["presentations"][number] | undefined) {
  return (master.canonical_type === "universe" || master.canonical_type === "mural") && presentation?.title === "Super Hero Ego";
}

function StatusBadge({ label, good = false }: { label: string; good?: boolean }) {
  return <Badge variant={good ? "secondary" : "outline"}>{label}</Badge>;
}

async function api(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// ─── Step indicator ──────────────────────────────────────────────────────────

// ─── Work card ───────────────────────────────────────────────────────────────

type WorkCardProps = {
  master: AuthorityData["masters"][number];
  state: AuthorityData["states"][number] | undefined;
  projection: AuthorityData["projections"][number] | undefined;
  binding: AuthorityData["bindings"][number] | undefined;
  presentation: AuthorityData["presentations"][number] | undefined;
  projectionPresentation: AuthorityData["projectionPresentations"][number] | undefined;
  realizations: AuthorityData["realizations"];
  onAuthorise: (masterId: string) => Promise<void>;
  onCreateExperience: (stateId: string, masterId: string, type: string) => Promise<void>;
  onAttachVideo: (projId: string, masterId: string) => void;
  onDesignate: (projId: string, masterId: string) => Promise<void>;
  onEditPresentation: (masterId: string) => void;
  onEditProjectionPresentation: (projId: string, masterId: string) => void;
  onEditTimeline: (bindingId: string, masterId: string) => void;
  onEditRealization: (bindingId: string, masterId: string) => void;
  busy: boolean;
};

function WorkCard({
  master, state, projection, binding, presentation, projectionPresentation,
  realizations,
  onAuthorise, onCreateExperience, onAttachVideo, onDesignate,
  onEditPresentation, onEditProjectionPresentation,
  onEditTimeline,
  onEditRealization,
  busy,
}: WorkCardProps) {
  const [expType, setExpType] = useState("experiential");
  const typeLabel = WORK_TYPE_LABELS[master.canonical_type] ?? master.canonical_type;
  const status = getWorkStatus(master, state, projection, binding, presentation, projectionPresentation, realizations);
  const isCollectible = projection?.collectible_designated ?? false;
  const official = isOfficialAnimation(master, presentation);
  const artworkUrl = presentation?.artwork_asset?.storage_ref ?? projectionPresentation?.artwork_asset?.storage_ref ?? null;

  return (
    <Card size="sm">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 min-w-0">
            <span className="text-foreground text-sm font-medium block truncate">
              {presentation?.title ?? typeLabel}
            </span>
            <div className="flex flex-wrap gap-1.5 pt-1"><StatusBadge label={typeLabel} />{official && <Badge>Official animation</Badge>}<StatusBadge label={status.needs} good={status.ready} /></div>
          </div>
          {artworkUrl && <img src={artworkUrl} alt="" className="h-12 w-20 shrink-0 rounded object-cover" />}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <StatusBadge label="Registered" good />
          <StatusBadge label={status.hasState ? "Authorised" : "Needs authorisation"} good={status.hasState} />
          <StatusBadge label={status.hasExperience ? "Experience" : "Needs experience"} good={status.hasExperience} />
          <StatusBadge label={status.playable ? "Playable" : status.hasMedia ? "Media attached" : "Needs media"} good={status.playable} />
          {(master.canonical_type === "scene" || master.canonical_type === "mural") && <StatusBadge label={status.hasArtwork ? "Artwork" : "Artwork recommended"} good={status.hasArtwork} />}
          {master.canonical_type === "scene" && <StatusBadge label={status.needsTimeline ? "Needs timeline" : "Timeline set"} good={!status.needsTimeline} />}
          <StatusBadge label={status.hasRealization ? "Realization recorded" : "Realization not recorded"} good={status.hasRealization} />
          <StatusBadge label={status.rightsVerified ? "Rights recorded" : "Rights review"} good={status.rightsVerified} />
          {isCollectible && <Badge>Collectible</Badge>}
        </div>

        {!status.hasState && (
          <Button size="sm" disabled={busy} onClick={() => onAuthorise(master.master_id)}>
            Authorise work
          </Button>
        )}

        {status.hasState && !status.hasExperience && (
          <div className="space-y-2">
            <select
              value={expType}
              onChange={e => setExpType(e.target.value)}
              className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
            >
              {PROJECTION_TYPES.map(t => (
                <option key={t} value={t}>{EXPERIENCE_TYPE_LABELS[t]}</option>
              ))}
            </select>
            <Button size="sm" disabled={busy} onClick={() => onCreateExperience(state!.canonical_state_id, master.master_id, expType)}>
              Create Experience
            </Button>
          </div>
        )}

        {status.hasExperience && (
          <button
            type="button"
            onClick={() => onEditProjectionPresentation(projection!.projection_id, master.master_id)}
            className="text-muted-foreground text-xs hover:text-foreground transition-colors"
          >
            {projectionPresentation ? "Edit moment title" : "Set moment title"}
          </button>
        )}

        {status.hasExperience && !status.hasMedia && (
          <Button size="sm" disabled={busy} onClick={() => onAttachVideo(projection!.projection_id, master.master_id)}>
            Attach media
          </Button>
        )}

        {status.hasExperience && status.hasMedia && !isCollectible && (
          <Button size="sm" disabled={busy} onClick={() => onDesignate(projection!.projection_id, master.master_id)}>
            Designate as Collectible
          </Button>
        )}

        {status.hasExperience && status.hasMedia && (
          <button
            type="button"
            onClick={() => onEditTimeline(binding!.binding_id, master.master_id)}
            className="text-muted-foreground text-xs hover:text-foreground transition-colors"
          >
            {binding!.start_ms != null && binding!.end_ms != null ? "Adjust timeline" : "Set timeline"}
          </button>
        )}

        {status.hasExperience && status.hasMedia && !status.hasRealization && (
          <button type="button" onClick={() => onEditRealization(binding!.binding_id, master.master_id)} className="text-muted-foreground text-xs hover:text-foreground transition-colors">
            Record realization
          </button>
        )}

        {status.ready && <p className="text-muted-foreground text-xs">Ready</p>}
      </CardContent>
    </Card>
  );
}

type TimelineEditorProps = {
  binding: AuthorityData["bindings"][number];
  masterId: string;
  onDone: () => void;
  onCancel: () => void;
};

function formatTimelineMs(value: number | null) {
  if (value == null) return "--:--.---";
  const totalSeconds = Math.floor(value / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}.${String(value % 1000).padStart(3, "0")}`;
}

function TimelineEditor({ binding, masterId, onDone, onCancel }: TimelineEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [startMs, setStartMs] = useState(binding.start_ms ?? 0);
  const [endMs, setEndMs] = useState(binding.end_ms ?? 0);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const startRef = useRef(startMs);
  const endRef = useRef(endMs);
  const previewingRef = useRef(previewing);
  startRef.current = startMs;
  endRef.current = endMs;
  previewingRef.current = previewing;

  useEffect(() => {
    const video = videoRef.current;
    const playbackId = binding.media_asset?.storage_ref;
    if (!video || !playbackId) return;

    const onTimeUpdate = () => {
      const value = Math.round(video.currentTime * 1000);
      setCurrentMs(value);
      if (previewingRef.current && endRef.current > startRef.current && value >= endRef.current) {
        video.pause();
        video.currentTime = startRef.current / 1000;
        setPreviewing(false);
      }
    };
    const onLoadedMetadata = () => setDurationMs(Math.round(video.duration * 1000));
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);

    fetch(`/api/livepeer/playback/${playbackId}`)
      .then(response => response.ok ? response.json() : null)
      .then(info => {
        const hls = info?.meta?.source?.find((source: { type: string; url: string }) => source.type === "html5/application/vnd.apple.mpegurl");
        if (!hls) throw new Error("No playable HLS source returned.");
        setThumbnailUrl(hls.url.replace("/index.m3u8", "/thumbnails/keyframes_0.png"));
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = hls.url;
        } else {
          import("hls.js").then(({ default: Hls }) => {
            if (!Hls.isSupported()) throw new Error("This browser cannot play the media stream.");
            const hlsPlayer = new Hls();
            hlsRef.current = hlsPlayer;
            hlsPlayer.loadSource(hls.url);
            hlsPlayer.attachMedia(video);
          });
        }
      })
      .catch(error => setMessage(`Error: ${error instanceof Error ? error.message : "Unable to load preview"}`));

    return () => {
      video.pause();
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [binding.media_asset?.storage_ref]);

  async function saveRange() {
    if (!Number.isInteger(startMs) || !Number.isInteger(endMs) || endMs <= startMs) {
      setMessage("Error: End must be greater than start.");
      return;
    }
    setBusy(true); setMessage(null);
    const response = await fetch("/api/authority/media/timeline", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ binding_id: binding.binding_id, master_id: masterId, start_ms: startMs, end_ms: endMs }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok || result.error) { setMessage(`Error: ${result.error ?? "Unable to save timeline"}`); return; }
    setMessage("Timeline saved.");
    onDone();
  }

  function previewRange() {
    const video = videoRef.current;
    if (!video || endMs <= startMs) return;
    video.currentTime = startMs / 1000;
    setPreviewing(true);
    void video.play();
  }

  async function selectThumbnail() {
    if (!thumbnailUrl) return;
    setBusy(true); setMessage(null);
    const response = await fetch("/api/authority/media/artwork", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ master_id: masterId, projection_id: binding.projection_id, thumbnail_url: thumbnailUrl }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok || result.error) { setMessage(`Error: ${result.error ?? "Unable to select thumbnail"}`); return; }
    setMessage("Livepeer thumbnail selected as representative artwork.");
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-foreground text-sm font-medium block">Timeline realization</span>
            <span className="text-muted-foreground text-xs">Capture boundaries from the actual video player.</span>
          </div>
          {!busy && <button type="button" onClick={onCancel} className="text-muted-foreground text-xs hover:text-foreground">Cancel</button>}
        </div>
        <video ref={videoRef} controls className="w-full aspect-video bg-black" />
        {thumbnailUrl && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Representative artwork preview</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbnailUrl} alt="Generated video thumbnail" className="w-32 aspect-video object-cover border border-border" />
            <Button size="sm" variant="outline" onClick={selectThumbnail} disabled={busy}>Use Livepeer thumbnail as artwork</Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">Current {formatTimelineMs(currentMs)}</Badge>
          <Badge variant="outline">Duration {formatTimelineMs(durationMs)}</Badge>
          <Badge variant="secondary">{formatTimelineMs(startMs)} → {formatTimelineMs(endMs)}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" onClick={() => setStartMs(currentMs)}>Set Start</Button>
          <Button size="sm" variant="outline" onClick={() => setEndMs(currentMs)}>Set End</Button>
          <label className="text-muted-foreground text-xs">Start (ms)<input type="number" min="0" value={startMs} onChange={event => setStartMs(Number(event.target.value))} className="border-input bg-background text-foreground mt-1 w-full rounded-md border px-2 py-1.5" /></label>
          <label className="text-muted-foreground text-xs">End (ms)<input type="number" min="1" value={endMs} onChange={event => setEndMs(Number(event.target.value))} className="border-input bg-background text-foreground mt-1 w-full rounded-md border px-2 py-1.5" /></label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={previewRange} disabled={endMs <= startMs}>Preview range</Button>
          <Button size="sm" variant="outline" onClick={() => { setStartMs(0); setEndMs(durationMs); setPreviewing(false); }}>Reset range</Button>
          <Button size="sm" onClick={saveRange} disabled={busy || endMs <= startMs}>Save exact range</Button>
        </div>
        {message && <p className={`text-sm ${message.startsWith("Error") ? "text-destructive" : "text-foreground"}`}>{message}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Attach Video panel ───────────────────────────────────────────────────────

type AttachVideoPanelProps = {
  projId: string;
  masterId: string;
  onDone: () => void;
  onCancel: () => void;
};

function AttachVideoPanel({ projId, masterId, onDone, onCancel }: AttachVideoPanelProps) {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [rightsHolderRef, setRightsHolderRef] = useState("");
  const [rightsBasis, setRightsBasis] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadPhase, setUploadPhase] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadStage, setUploadStage] = useState<"selecting" | "validating" | "uploading" | "processing" | "ready" | "failed">("selecting");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const statusMessage =
    uploadStage === "selecting"
      ? "Select a video file to begin the Livepeer upload flow."
      : uploadStage === "validating"
      ? "Checking the selected file and intake metadata."
      : uploadStage === "uploading"
      ? "Uploading to Livepeer…"
      : uploadStage === "processing"
      ? "Livepeer is preparing your video for playback."
      : uploadStage === "ready"
      ? "Video is ready to attach."
      : "Upload status unknown.";

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-foreground text-sm font-medium">Attach Video</span>
          {!uploadBusy && (
            <button type="button" onClick={onCancel} className="text-muted-foreground text-xs hover:text-foreground">Cancel</button>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Rights</p>
          <input
            value={rightsHolderRef}
            onChange={e => setRightsHolderRef(e.target.value)}
            placeholder="Rights holder participant ID (required for new assets)"
            disabled={uploadBusy}
            className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          />
          <input
            value={rightsBasis}
            onChange={e => setRightsBasis(e.target.value)}
            placeholder="Rights basis (for example: owned, licensed)"
            disabled={uploadBusy}
            className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          />
          <p className="text-muted-foreground text-xs">Both fields are required before a new file can enter the media pipeline.</p>
        </div>

        {/* File picker */}
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Choose video</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/*"
            disabled={uploadBusy}
            onChange={e => { setUploadFile(e.target.files?.[0] ?? null); setUploadMsg(null); }}
            className="sr-only"
          />
          <button
            type="button"
            disabled={uploadBusy}
            onClick={() => fileInputRef.current?.click()}
            className={`w-full rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors
              ${uploadFile ? "border-border bg-muted/30" : "border-border hover:border-foreground/30 hover:bg-muted/20 cursor-pointer"}
              disabled:pointer-events-none disabled:opacity-50`}
          >
            {uploadFile ? (
              <div className="space-y-0.5">
                <p className="text-foreground text-sm font-medium">{uploadFile.name}</p>
                <p className="text-muted-foreground text-xs">{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-foreground text-sm">＋ Choose MP4 video</p>
                <p className="text-muted-foreground text-xs">MP4 · Full video · Uploads directly to Mighty Verse</p>
              </div>
            )}
          </button>
        </div>

        {/* Progress */}
        {uploadBusy && (
          <div className="space-y-2">
            {uploadProgress !== null && uploadProgress < 100 ? (
              <>
                <p className="text-foreground text-sm">{statusMessage}</p>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-foreground transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="text-muted-foreground text-xs">{uploadProgress}%</p>
              </>
            ) : (
              <>
                <p className="text-foreground text-sm">
                  {uploadStage === "ready" ? "Video ready" : uploadStage === "failed" ? "Upload failed" : "Processing video…"}
                </p>
                <p className="text-muted-foreground text-xs">{statusMessage}</p>
              </>
            )}
          </div>
        )}

        {uploadMsg && (
          <p className={`text-sm ${uploadMsg.startsWith("Error") ? "text-destructive" : "text-foreground"}`}>
            {uploadMsg.startsWith("Error") ? uploadMsg : "✓ " + uploadMsg}
          </p>
        )}

        <Button
          size="sm"
          disabled={uploadBusy || !uploadFile || (!!rightsHolderRef !== !!rightsBasis)}
          onClick={async () => {
            if (!uploadFile) return;
            setUploadBusy(true); setUploadMsg(null); setUploadProgress(null); setUploadPhase(null); setUploadStage("validating");
            try {
              if (!uploadFile.type.startsWith("video/")) throw new Error("Select a video file.");
              if (!rightsHolderRef || !rightsBasis) throw new Error("Rights holder and rights basis are required for a new upload.");
              setUploadStage("uploading");
              const session = await fetch("/api/authority/media/upload-session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: uploadFile.name, projection_id: projId, master_id: masterId }),
              }).then(r => r.json());

              if (session.error || !session.upload_url || !session.asset_id) {
                throw new Error(session.error ?? "Upload session is incomplete.");
              }

              const { upload_url, asset_id } = session;

              await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.upload.onprogress = e => {
                  if (e.lengthComputable) setUploadProgress(Math.round(e.loaded / e.total * 100));
                };
                xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
                xhr.onerror = () => reject(new Error("Upload network error"));
                xhr.open("PUT", upload_url);
                // Do NOT set Content-Type — Livepeer's pre-signed URL handles it
                xhr.send(uploadFile);
              });

              setUploadProgress(100);
              setUploadStage("processing");

              let phase = "uploading";
              for (let attempt = 0; phase !== "ready" && attempt < 120; attempt += 1) {
                await new Promise(r => setTimeout(r, 3000));
                const statusResponse = await fetch(`/api/authority/media/upload-session/${asset_id}`);
                const status = await statusResponse.json();
                if (!statusResponse.ok || status.error) throw new Error(status.error ?? "Unable to verify Livepeer processing status.");
                phase = status.phase ?? "unknown";
                setUploadPhase(phase);
                if (phase === "failed") { setUploadMsg("Error: Livepeer processing failed"); setUploadStage("failed"); return; }
              }
              if (phase !== "ready") throw new Error("Livepeer processing did not become ready in time.");

              setUploadStage("ready");

              const attach = await fetch("/api/authority/media", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  projection_id: projId,
                  master_id: masterId,
                  livepeer_asset_id: asset_id,
                  rights_holder_ref: rightsHolderRef || null,
                  rights_basis: rightsBasis || null,
                }),
              }).then(r => r.json());

              if (attach.error) { setUploadMsg(`Error: ${attach.error}`); return; }
              setUploadMsg("Video attached. World and Moment are now playable.");
              setUploadFile(null); setRightsHolderRef(""); setRightsBasis(""); setUploadProgress(null); setUploadPhase(null); setUploadStage("ready");
              if (fileInputRef.current) fileInputRef.current.value = "";
              onDone();
            } catch (err) {
              setUploadMsg(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
              setUploadStage("failed");
            } finally {
              setUploadBusy(false);
            }
          }}
        >
          Upload & Attach Video
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Presentation panel ───────────────────────────────────────────────────────

type PresentationPanelProps = {
  masterId: string;
  existing: { title: string; description: string | null } | undefined;
  onDone: () => void;
  onCancel: () => void;
};

function PresentationPanel({ masterId, existing, onDone, onCancel }: PresentationPanelProps) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [artworkAssetId, setArtworkAssetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-foreground text-sm font-medium">Presentation</span>
          {!busy && <button type="button" onClick={onCancel} className="text-muted-foreground text-xs hover:text-foreground">Cancel</button>}
        </div>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={busy}
            className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={busy}
            rows={3}
            className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-none"
          />
          <input type="text" placeholder="Representative artwork asset ID (optional)" value={artworkAssetId} onChange={e => setArtworkAssetId(e.target.value)} disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm" />
        </div>
        {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-destructive" : "text-foreground"}`}>{msg}</p>}
        <Button
          size="sm"
          disabled={busy || !title.trim()}
          onClick={async () => {
            setBusy(true); setMsg(null);
            const res = await api("/api/authority/presentation", { master_id: masterId, title, description: description || null, artwork_asset_id: artworkAssetId || null });
            setBusy(false);
            if (res.error) { setMsg(`Error: ${res.error}`); return; }
            onDone();
          }}
        >
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Projection presentation panel ───────────────────────────────────────────

type ProjectionPresentationPanelProps = {
  projectionId: string;
  masterId: string;
  existing: { title: string; description: string | null } | undefined;
  onDone: () => void;
  onCancel: () => void;
};

function ProjectionPresentationPanel({ projectionId, masterId, existing, onDone, onCancel }: ProjectionPresentationPanelProps) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [artworkAssetId, setArtworkAssetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-foreground text-sm font-medium">Moment Presentation</span>
          {!busy && <button type="button" onClick={onCancel} className="text-muted-foreground text-xs hover:text-foreground">Cancel</button>}
        </div>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={busy}
            className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={busy}
            rows={3}
            className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-none"
          />
          <input type="text" placeholder="Representative artwork asset ID (optional)" value={artworkAssetId} onChange={e => setArtworkAssetId(e.target.value)} disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm" />
        </div>
        {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-destructive" : "text-foreground"}`}>{msg}</p>}
        <Button
          size="sm"
          disabled={busy || !title.trim()}
          onClick={async () => {
            setBusy(true); setMsg(null);
            const res = await api("/api/authority/projection-presentation", {
              projection_id: projectionId,
              master_id: masterId,
              title,
              description: description || null,
              artwork_asset_id: artworkAssetId || null,
            });
            setBusy(false);
            if (res.error) { setMsg(`Error: ${res.error}`); return; }
            onDone();
          }}
        >
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

function MediaIntakePanel({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [workType, setWorkType] = useState("animation");
  const [sourceType, setSourceType] = useState("upload");
  const [sourceUrl, setSourceUrl] = useState("");
  const [isrc, setIsrc] = useState("");
  const [isrcStatus, setIsrcStatus] = useState("not-applicable");
  const [versionLabel, setVersionLabel] = useState("");
  const [provenanceNotes, setProvenanceNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setMessage(null);
    const result = await api("/api/authority/media-intake", {
      title,
      creator_name: creatorName || null,
      work_type: workType,
      source_type: sourceType,
      source_url: sourceType === "external-url" ? sourceUrl : null,
      isrc: isrc || null,
      isrc_status: workType === "song" || workType === "audio" ? isrcStatus : "not-applicable",
      version_label: versionLabel || null,
      provenance_notes: provenanceNotes || null,
    });
    setBusy(false);
    if (result.error) { setMessage(`Error: ${result.error}`); return; }
    onDone();
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-foreground text-sm font-medium block">New media intake</span>
            <span className="text-muted-foreground text-xs">Identity, source, ISRC state, and provenance.</span>
          </div>
          {!busy && <button type="button" onClick={onCancel} className="text-muted-foreground text-xs hover:text-foreground">Cancel</button>}
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm" />
        <input value={creatorName} onChange={e => setCreatorName(e.target.value)} placeholder="Artist / creator" disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <select value={workType} onChange={e => setWorkType(e.target.value)} disabled={busy} className="border-input bg-background text-foreground rounded-md border px-3 py-2 text-sm">
            <option value="animation">Animation</option><option value="video">Video</option><option value="song">Song</option><option value="audio">Audio</option><option value="other">Other</option>
          </select>
          <input value={versionLabel} onChange={e => setVersionLabel(e.target.value)} placeholder="Version / release" disabled={busy} className="border-input bg-background text-foreground rounded-md border px-3 py-2 text-sm" />
        </div>
        <select value={sourceType} onChange={e => setSourceType(e.target.value)} disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm">
          <option value="upload">Local upload</option><option value="external-url">Authorised external URL</option><option value="livepeer-asset">Existing Livepeer asset</option>
        </select>
        {sourceType === "external-url" && <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://… (YouTube references are preserved, never downloaded)" disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm" />}
        {(workType === "song" || workType === "audio") && (
          <div className="grid grid-cols-2 gap-2">
            <select value={isrcStatus} onChange={e => setIsrcStatus(e.target.value)} disabled={busy} className="border-input bg-background text-foreground rounded-md border px-3 py-2 text-sm">
              <option value="verified">ISRC verified</option><option value="not-provided">Released but ISRC not provided</option><option value="not-applicable">Unreleased / no ISRC</option>
            </select>
            <input value={isrc} onChange={e => setIsrc(e.target.value.toUpperCase())} placeholder="ISRC" disabled={busy || isrcStatus !== "verified"} className="border-input bg-background text-foreground rounded-md border px-3 py-2 text-sm" />
          </div>
        )}
        <textarea value={provenanceNotes} onChange={e => setProvenanceNotes(e.target.value)} placeholder="Provenance / production notes" disabled={busy} rows={3} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm resize-none" />
        {message && <p className="text-destructive text-sm">{message}</p>}
        <Button size="sm" disabled={busy || !title.trim() || (sourceType === "external-url" && !sourceUrl.trim())} onClick={submit}>Create intake record</Button>
      </CardContent>
    </Card>
  );
}

function RealizationPanel({
  binding,
  masterId,
  onDone,
  onCancel,
}: {
  binding: AuthorityData["bindings"][number];
  masterId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState("animated-video");
  const [rightsHolderRef, setRightsHolderRef] = useState("");
  const [rightsBasis, setRightsBasis] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setMessage(null);
    const created = await api("/api/authority/media-realization", {
      master_id: masterId,
      realization_type: type,
      rights_holder_ref: rightsHolderRef || null,
      rights_basis: rightsBasis || null,
      production_notes: notes || null,
    });
    if (created.error) { setBusy(false); setMessage(`Error: ${created.error}`); return; }
    const bound = await fetch("/api/authority/media-realization/bind", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ binding_id: binding.binding_id, master_id: masterId, realization_id: created.realization_id }),
    }).then(response => response.json());
    setBusy(false);
    if (bound.error) { setMessage(`Error: ${bound.error}`); return; }
    onDone();
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div><span className="text-foreground text-sm font-medium block">Record realization</span><span className="text-muted-foreground text-xs">Production context attached to this media binding.</span></div>
          {!busy && <button type="button" onClick={onCancel} className="text-muted-foreground text-xs hover:text-foreground">Cancel</button>}
        </div>
        <select value={type} onChange={e => setType(e.target.value)} disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm">
          <option value="animated-video">Animated video</option><option value="music-video">Music video</option><option value="original-recording">Original recording</option><option value="visualisation">Visualisation</option><option value="other">Other</option>
        </select>
        <input value={rightsHolderRef} onChange={e => setRightsHolderRef(e.target.value)} placeholder="Realization rights holder participant ID" disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm" />
        <input value={rightsBasis} onChange={e => setRightsBasis(e.target.value)} placeholder="Realization rights basis" disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm" />
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Production context / provenance notes" disabled={busy} rows={3} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm resize-none" />
        {message && <p className="text-destructive text-sm">{message}</p>}
        <Button size="sm" disabled={busy || !rightsHolderRef || !rightsBasis} onClick={submit}>Record and associate realization</Button>
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AuthorityClient() {
  const [data, setData] = useState<AuthorityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Register New Work
  const [showRegister, setShowRegister] = useState(false);
  const [showIntake, setShowIntake] = useState(false);
  const [canonicalType, setCanonicalType] = useState<string>("universe");

  // Attach Video panel — which projection is currently open
  const [attachingProjId, setAttachingProjId] = useState<string | null>(null);
  const [attachingMasterId, setAttachingMasterId] = useState<string | null>(null);

  // Presentation panel — which master is currently open
  const [presentingMasterId, setPresentingMasterId] = useState<string | null>(null);

  // Projection presentation panel
  const [presentingProjId, setPresentingProjId] = useState<string | null>(null);
  const [presentingProjMasterId, setPresentingProjMasterId] = useState<string | null>(null);
  const [editingTimelineBindingId, setEditingTimelineBindingId] = useState<string | null>(null);
  const [editingTimelineMasterId, setEditingTimelineMasterId] = useState<string | null>(null);
  const [editingRealizationBindingId, setEditingRealizationBindingId] = useState<string | null>(null);
  const [editingRealizationMasterId, setEditingRealizationMasterId] = useState<string | null>(null);

  async function load() {
    const d = await api("/api/authority");
    if (d.error) { setError(d.error); return; }
    setData(d);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(label: string, path: string, body: unknown) {
    setBusy(true); setMsg(null);
    const d = await api(path, body);
    setBusy(false);
    if (d.error) { setMsg(`Error: ${d.error}`); return; }
    setMsg(`${label} succeeded.`);
    await load();
  }

  if (error) return <p className="text-destructive p-6 text-sm">{error}</p>;
  if (!data) return <p className="text-muted-foreground p-6 text-sm">Loading…</p>;

  const { authority, masters, states, projections, bindings, presentations, projectionPresentations, realizations } = data;

  function getState(masterId: string) {
    return states.find(s => s.master_id === masterId);
  }
  function getProjection(masterId: string) {
    return projections.find(p => p.master_id === masterId);
  }
  function getBinding(projectionId: string) {
    return bindings.find(b => b.projection_id === projectionId);
  }
  function getPresentation(masterId: string) {
    return presentations.find(p => p.master_id === masterId);
  }
  function getProjectionPresentation(projectionId: string) {
    return projectionPresentations.find(p => p.projection_id === projectionId);
  }

  const workRecords: WorkRecord[] = masters.map(master => {
    const state = getState(master.master_id);
    const projection = getProjection(master.master_id);
    const binding = projection ? getBinding(projection.projection_id) : undefined;
    const presentation = getPresentation(master.master_id);
    const projectionPresentation = projection ? getProjectionPresentation(projection.projection_id) : undefined;
    return {
      master,
      state,
      projection,
      binding,
      presentation,
      projectionPresentation,
      status: getWorkStatus(master, state, projection, binding, presentation, projectionPresentation, realizations),
    };
  });

  const groupedRecords = ["universe", "mural", "creative-moment", "scene"].map(type => ({
    type,
    label: WORK_TYPE_LABELS[type],
    records: workRecords.filter(record => record.master.canonical_type === type),
  }));
  const orderedRecords = groupedRecords.flatMap(group => group.records);
  const officialRecord = workRecords.find(record => isOfficialAnimation(record.master, record.presentation));
  const overviewCounts = [
    ["Universes", workRecords.filter(record => record.master.canonical_type === "universe").length],
    ["Murals", workRecords.filter(record => record.master.canonical_type === "mural").length],
    ["Creative Moments", workRecords.filter(record => record.master.canonical_type === "creative-moment").length],
    ["Scenes", workRecords.filter(record => record.master.canonical_type === "scene").length],
    ["Registered", workRecords.length],
    ["Authorised", workRecords.filter(record => record.status.hasState).length],
    ["Experiential", workRecords.filter(record => record.status.hasExperience).length],
    ["Playable", workRecords.filter(record => record.status.playable).length],
    ["Collectible", projections.filter(projection => projection.collectible_designated).length],
    ["Needs attention", workRecords.filter(record => !record.status.ready).length],
  ];

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside className="border-b border-border bg-card px-4 py-4 lg:min-h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r lg:px-5">
        <div className="mb-5"><p className="text-foreground text-sm font-semibold">Mighty Verse</p><p className="text-muted-foreground text-xs">Authority console</p></div>
        <nav className="grid grid-cols-2 gap-1 text-xs lg:block lg:space-y-4">
          <div><p className="mb-1 px-2 text-muted-foreground uppercase tracking-widest">Authority</p><a href="#overview" className="block rounded-md bg-muted px-2 py-1.5 text-foreground">Overview</a></div>
          <div><p className="mb-1 px-2 text-muted-foreground uppercase tracking-widest">Catalogue</p><div className="space-y-0.5 lg:space-y-1"><a href="#universes" className="block px-2 py-1 text-muted-foreground hover:text-foreground">Universes</a><a href="#murals" className="block px-2 py-1 text-muted-foreground hover:text-foreground">Murals</a><a href="#creative-moments" className="block px-2 py-1 text-muted-foreground hover:text-foreground">Creative Moments</a><a href="#scenes" className="block px-2 py-1 text-muted-foreground hover:text-foreground">Scenes</a></div></div>
          <div><p className="mb-1 px-2 text-muted-foreground uppercase tracking-widest">Media</p><div className="space-y-0.5 lg:space-y-1"><a href="#ingestion" className="block px-2 py-1 text-muted-foreground hover:text-foreground">Media intake</a><a href="#realizations" className="block px-2 py-1 text-muted-foreground hover:text-foreground">Realizations</a><a href="#artwork" className="block px-2 py-1 text-muted-foreground hover:text-foreground">Artwork</a></div></div>
          <div><p className="mb-1 px-2 text-muted-foreground uppercase tracking-widest">Publishing</p><a href="#catalogue" className="block px-2 py-1 text-muted-foreground hover:text-foreground">Experiences</a></div>
          <div><p className="mb-1 px-2 text-muted-foreground uppercase tracking-widest">Governance</p><div className="space-y-0.5 lg:space-y-1"><a href="#canonical" className="block px-2 py-1 text-muted-foreground hover:text-foreground">Canonical records</a><span className="block px-2 py-1 text-muted-foreground/60">Rights &amp; authority</span></div></div>
        </nav>
      </aside>
      <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:px-8">

      {/* Header */}
      <div id="overview" className="border-b border-border pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-foreground text-2xl font-semibold">Mighty Verse Authority</h1>
            <p className="text-muted-foreground text-sm">Full authority over this catalogue.</p>
          </div>
          <Badge variant="outline">{authority.scope_type} scope · {authority.capabilities.length} capabilities</Badge>
        </div>
      </div>

      <div className="space-y-3">
        <div><h2 className="text-foreground text-sm font-medium">Overview</h2><p className="text-muted-foreground text-xs">Catalogue shape and operational readiness.</p></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {overviewCounts.map(([label, count]) => <Card key={label} size="sm"><CardContent className="space-y-1 pt-3"><p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p><p className="text-foreground text-2xl font-semibold">{count}</p></CardContent></Card>)}
        </div>
      </div>

      {officialRecord && (
        <section className="space-y-3">
          <div><h2 className="text-foreground text-sm font-medium">Official animation</h2><p className="text-muted-foreground text-xs">The current official animated expression in the catalogue.</p></div>
          <Card className="border-foreground/20"><CardContent className="flex flex-wrap items-center justify-between gap-4 pt-4"><div><p className="text-foreground text-lg font-medium">{officialRecord.presentation?.title}</p><div className="mt-1 flex flex-wrap gap-1.5"><Badge>Official animation</Badge><StatusBadge label="Mural / Universe experience" /></div></div><div className="flex flex-wrap gap-2"><StatusBadge label={officialRecord.status.playable ? "Playable" : officialRecord.status.needs} good={officialRecord.status.playable} /><a href="#murals" className="text-sm text-foreground underline-offset-4 hover:underline">Open catalogue</a></div></CardContent></Card>
        </section>
      )}

      <div id="ingestion">
        <h2 className="text-foreground text-sm font-medium">Ingestion</h2>
        <p className="text-muted-foreground text-xs">Register and prepare media before canonical publication.</p>
      </div>

      {msg && (
        <p className={`text-sm ${msg.startsWith("Error") ? "text-destructive" : "text-foreground"}`}>{msg}</p>
      )}

      {/* Register New Work */}
      <div>
        {!showIntake ? (
          <Button size="sm" variant="outline" onClick={() => setShowIntake(true)}>
            + New Media Intake
          </Button>
        ) : (
          <MediaIntakePanel onDone={async () => { setShowIntake(false); await load(); }} onCancel={() => setShowIntake(false)} />
        )}
      </div>

      <div>
        {!showRegister ? (
          <Button size="sm" variant="outline" onClick={() => setShowRegister(true)}>
            + Register New Work
          </Button>
        ) : (
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-foreground text-sm font-medium">Register New Work</span>
                <button type="button" onClick={() => setShowRegister(false)} className="text-muted-foreground text-xs hover:text-foreground">Cancel</button>
              </div>
              <select
                value={canonicalType}
                onChange={e => setCanonicalType(e.target.value)}
                className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
              >
                {CANONICAL_TYPES.map(t => (
                  <option key={t} value={t}>{WORK_TYPE_LABELS[t]}</option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={busy}
                onClick={async () => {
                  await act("Register Work", "/api/authority/masters", { canonical_type: canonicalType });
                  setShowRegister(false);
                }}
              >
                Register Work
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <div id="catalogue" className="flex items-center justify-between"><h2 className="text-foreground text-sm font-medium">Catalogue</h2><span className="text-muted-foreground text-xs">{masters.length} works</span></div>

      {/* Work cards */}
      {masters.length === 0 && (
        <p className="text-muted-foreground text-sm">No works registered yet. Register your first work above.</p>
      )}

      {orderedRecords.map((record, index) => {
        const { master, state, projection, binding, presentation, projectionPresentation } = record;
        const previousType = orderedRecords[index - 1]?.master.canonical_type;
        const isGroupStart = previousType !== master.canonical_type;

        // Projection presentation panel open for this projection
        if (presentingProjId === projection?.projection_id) {
          return (
            <div key={master.master_id} className="space-y-2">
              {isGroupStart && <h3 id={`${master.canonical_type}s`} className="pt-4 text-muted-foreground text-xs font-medium uppercase tracking-widest">{WORK_TYPE_LABELS[master.canonical_type] ?? master.canonical_type}s</h3>}
              <ProjectionPresentationPanel projectionId={presentingProjId} masterId={presentingProjMasterId!} existing={projectionPresentation} onDone={async () => { setPresentingProjId(null); setPresentingProjMasterId(null); await load(); }} onCancel={() => { setPresentingProjId(null); setPresentingProjMasterId(null); }} />
            </div>
          );
        }

        // Presentation panel open for this master
        if (presentingMasterId === master.master_id) {
          return (
            <div key={master.master_id} className="space-y-2">
              {isGroupStart && <h3 id={`${master.canonical_type}s`} className="pt-4 text-muted-foreground text-xs font-medium uppercase tracking-widest">{WORK_TYPE_LABELS[master.canonical_type] ?? master.canonical_type}s</h3>}
              <PresentationPanel masterId={master.master_id} existing={presentation} onDone={async () => { setPresentingMasterId(null); await load(); }} onCancel={() => setPresentingMasterId(null)} />
            </div>
          );
        }

        // Attach video panel
        if (attachingProjId === projection?.projection_id) {
          return (
            <div key={master.master_id} className="space-y-2">
              {isGroupStart && <h3 id={`${master.canonical_type}s`} className="pt-4 text-muted-foreground text-xs font-medium uppercase tracking-widest">{WORK_TYPE_LABELS[master.canonical_type] ?? master.canonical_type}s</h3>}
              <AttachVideoPanel projId={attachingProjId} masterId={attachingMasterId!} onDone={async () => { setAttachingProjId(null); setAttachingMasterId(null); await load(); }} onCancel={() => { setAttachingProjId(null); setAttachingMasterId(null); }} />
            </div>
          );
        }

        if (editingTimelineBindingId === binding?.binding_id) {
          return (
            <div key={master.master_id} className="space-y-2">
              {isGroupStart && <h3 id={`${master.canonical_type}s`} className="pt-4 text-muted-foreground text-xs font-medium uppercase tracking-widest">{WORK_TYPE_LABELS[master.canonical_type] ?? master.canonical_type}s</h3>}
              <TimelineEditor binding={binding} masterId={editingTimelineMasterId!} onDone={async () => { setEditingTimelineBindingId(null); setEditingTimelineMasterId(null); await load(); }} onCancel={() => { setEditingTimelineBindingId(null); setEditingTimelineMasterId(null); }} />
            </div>
          );
        }

        if (editingRealizationBindingId === binding?.binding_id) {
          return (
            <div key={master.master_id} className="space-y-2">
              {isGroupStart && <h3 id={`${master.canonical_type}s`} className="pt-4 text-muted-foreground text-xs font-medium uppercase tracking-widest">{WORK_TYPE_LABELS[master.canonical_type] ?? master.canonical_type}s</h3>}
              <RealizationPanel binding={binding} masterId={editingRealizationMasterId!} onDone={async () => { setEditingRealizationBindingId(null); setEditingRealizationMasterId(null); await load(); }} onCancel={() => { setEditingRealizationBindingId(null); setEditingRealizationMasterId(null); }} />
            </div>
          );
        }

        return (
          <div key={master.master_id} className="space-y-2">
            {isGroupStart && <h3 id={`${master.canonical_type}s`} className="pt-4 text-muted-foreground text-xs font-medium uppercase tracking-widest">{WORK_TYPE_LABELS[master.canonical_type] ?? master.canonical_type}s</h3>}
            <WorkCard
            master={master}
            state={state}
            projection={projection}
            binding={binding}
            presentation={presentation}
            projectionPresentation={projectionPresentation}
            realizations={realizations}
            busy={busy}
            onAuthorise={masterId => act("Authorise Work", "/api/authority/states", { master_id: masterId })}
            onCreateExperience={(stateId, masterId, type) =>
              act("Create Experience", "/api/authority/projections", { canonical_state_id: stateId, master_id: masterId, projection_type: type })
            }
            onAttachVideo={(projId, masterId) => { setAttachingProjId(projId); setAttachingMasterId(masterId); }}
            onDesignate={(projId, masterId) =>
              act("Designate Collectible", "/api/authority/collectibles", { projection_id: projId, master_id: masterId })
            }
            onEditPresentation={masterId => setPresentingMasterId(masterId)}
            onEditProjectionPresentation={(projId, masterId) => { setPresentingProjId(projId); setPresentingProjMasterId(masterId); }}
            onEditTimeline={(bindingId, masterId) => { setEditingTimelineBindingId(bindingId); setEditingTimelineMasterId(masterId); }}
            onEditRealization={(bindingId, masterId) => { setEditingRealizationBindingId(bindingId); setEditingRealizationMasterId(masterId); }}
            />
          </div>
        );
      })}

      <Separator />

      {/* Canonical Record — secondary technical view */}
      <details id="canonical" className="group space-y-4">
        <summary className="cursor-pointer list-none text-foreground text-sm font-medium">
          <span className="mr-2 text-muted-foreground group-open:hidden">+</span>
          <span className="mr-2 text-muted-foreground hidden group-open:inline">−</span>
          View canonical record
          <span className="block pl-5 text-muted-foreground text-xs font-normal">Technical verification of the canonical chain.</span>
        </summary>

        {masters.length === 0 && <p className="text-muted-foreground text-xs">No records yet.</p>}

        {masters.map(m => {
          const mStates = states.filter(s => s.master_id === m.master_id);
          const mProjs = projections.filter(p => p.master_id === m.master_id);
          const typeLabel = WORK_TYPE_LABELS[m.canonical_type] ?? m.canonical_type;
          return (
            <Card key={m.master_id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{typeLabel}</Badge>
                  <span className="text-muted-foreground font-mono text-xs cursor-default" title={m.master_id}>{shortId(m.master_id)}…</span>
                </div>
                {mStates.length === 0 && <p className="text-muted-foreground text-xs pl-4">No authorised state.</p>}
                {mStates.map(s => (
                  <div key={s.canonical_state_id} className="pl-4 border-l border-border space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">v{s.version}</Badge>
                      <Badge variant="outline">{s.authorisation_state}</Badge>
                      <span className="text-muted-foreground font-mono text-xs cursor-default" title={s.canonical_state_id}>{shortId(s.canonical_state_id)}…</span>
                    </div>
                    {mProjs.filter(p => p.canonical_state_id === s.canonical_state_id).map(p => {
                      const pBindings = bindings.filter(b => b.projection_id === p.projection_id);
                      const projLabel = EXPERIENCE_TYPE_LABELS[p.projection_type] ?? p.projection_type;
                      return (
                        <div key={p.projection_id} className="pl-4 border-l border-border space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge>{projLabel}</Badge>
                            {p.collectible_designated && <Badge variant="secondary">collectible</Badge>}
                            <span className="text-muted-foreground font-mono text-xs cursor-default" title={p.projection_id}>{shortId(p.projection_id)}…</span>
                          </div>
                          {pBindings.length === 0 && <p className="text-muted-foreground text-xs pl-4">No media.</p>}
                          {pBindings.map(b => (
                            <div key={b.binding_id} className="pl-4 flex items-center gap-2">
                              <Badge variant="outline">{b.binding_type}</Badge>
                              <Badge variant="outline">{b.access_level}</Badge>
                              <span className="text-muted-foreground font-mono text-xs cursor-default" title={b.asset_id}>{shortId(b.asset_id)}…</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {mProjs.filter(p => p.canonical_state_id === s.canonical_state_id).length === 0 && (
                      <p className="text-muted-foreground text-xs pl-4">No experience.</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </details>
      </main>
    </div>
  );
}

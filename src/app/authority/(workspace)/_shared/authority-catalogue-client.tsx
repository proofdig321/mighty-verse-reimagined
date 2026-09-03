"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Archive, BarChart3, ChevronRight, Database, FileText, Image, MoreHorizontal, PlaySquare, Plus, Search, ShieldCheck, Upload, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import MediaVisual from "@/components/media-visual";
import {
  api, responseData, shortId, operatorError,
  WORK_TYPE_LABELS, EXPERIENCE_TYPE_LABELS, PROJECTION_TYPES,
  getWorkStatus, getJourneySteps, getNextAction,
  type WorkStatus, type JourneyStep,
} from "./authority-utils";
import {
  StatusBadge, WorkJourney, PresentationPanel, ProjectionPresentationPanel,
  RealizationPanel, CreateExperiencePanel,
} from "./authority-panels";

type AuthorityData = {
  authority: { authority_id: string; authority_type: string; scope_type: string; capabilities: string[] };
  masters: { master_id: string; canonical_type: string; parent_master_id: string | null; current_state_id: string | null; created_at: string }[];
  states: { canonical_state_id: string; master_id: string; version: number; authorisation_state: string; integrity_hash: string; created_at: string }[];
  projections: { projection_id: string; canonical_state_id: string; master_id: string; projection_type: string; collectible_designated: boolean; integrity_hash: string; created_at: string }[];
  bindings: { binding_id: string; projection_id: string; binding_type: string; access_level: string; asset_id: string; start_ms: number | null; end_ms: number | null; realization_id: string | null; media_asset: { storage_ref: string; asset_type: string; rights_holder_ref: string | null; rights_basis: string | null } | null }[];
  presentations: { master_id: string; title: string; description: string | null; artwork_asset_id: string | null; artwork_asset: { storage_ref: string } | null }[];
  projectionPresentations: { projection_id: string; title: string; description: string | null; artwork_asset_id: string | null; artwork_asset: { storage_ref: string } | null }[];
  realizations: { realization_id: string; master_id: string; realization_type: string; rights_holder_ref: string | null; rights_basis: string | null; production_notes: string | null }[];
  participants: { participant_id: string; label: string }[];
  mediaAssets: { asset_id: string; asset_type: string; storage_ref: string; format: string | null; duration_ms: number | null; created_at: string; title: string | null; master_id: string | null }[];
};

const CANONICAL_TYPES = ["universe", "creative-moment", "mural", "scene", "interpretation", "other"] as const;

type WorkRecord = {
  master: AuthorityData["masters"][number];
  state: AuthorityData["states"][number] | undefined;
  projection: AuthorityData["projections"][number] | undefined;
  binding: AuthorityData["bindings"][number] | undefined;
  presentation: AuthorityData["presentations"][number] | undefined;
  projectionPresentation: AuthorityData["projectionPresentations"][number] | undefined;
  status: WorkStatus;
};

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
  onDesignate: (projId: string, masterId: string, workTitle: string) => Promise<void>;
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
  const typeLabel = WORK_TYPE_LABELS[master.canonical_type] ?? master.canonical_type;
  const status = getWorkStatus(master, state, projection, binding, presentation, projectionPresentation, realizations, master.master_id);
  const isCollectible = projection?.collectible_designated ?? false;
  const artworkUrl = presentation?.artwork_asset?.storage_ref ?? projectionPresentation?.artwork_asset?.storage_ref ?? null;
  const journey = getJourneySteps(master, status);
  const nextStep = getNextAction(master, status);

  return (
    <Card size="sm">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 min-w-0">
            <span className="text-foreground text-sm font-medium block truncate">
              {presentation?.title ?? typeLabel}
            </span>
            <div className="flex flex-wrap gap-1.5 pt-1"><StatusBadge label={typeLabel} /><StatusBadge label={status.needs} good={status.ready} /></div>
          </div>
          {artworkUrl && <img src={artworkUrl} alt="" className="h-12 w-20 shrink-0 rounded object-cover" />}
        </div>

        <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
          <WorkJourney steps={journey} />
          {!status.ready && <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Next step:</span> {nextStep}</p>}
          {isCollectible && <Badge>Collectible</Badge>}
        </div>

        {!status.hasState && (
          <Button size="sm" disabled={busy} onClick={() => onAuthorise(master.master_id)}>
            Authorise work
          </Button>
        )}

        {status.hasState && !status.hasExperience && (
          <CreateExperiencePanel stateId={state!.canonical_state_id} masterId={master.master_id} busy={busy} onCreate={onCreateExperience} />
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

        {status.hasExperience && master.canonical_type !== "creative-moment" && !status.hasMedia && (
          <Button size="sm" disabled={busy} onClick={() => onAttachVideo(projection!.projection_id, master.master_id)}>
            Attach media
          </Button>
        )}

        {status.hasExperience && status.hasMedia && !isCollectible && (
          <Button size="sm" disabled={busy} onClick={() => onDesignate(projection!.projection_id, master.master_id, presentation?.title ?? projectionPresentation?.title ?? typeLabel)}>
            Designate as Collectible
          </Button>
        )}

        {status.hasExperience && status.hasMedia && master.canonical_type === "scene" && (
          <button
            type="button"
            onClick={() => onEditTimeline(binding!.binding_id, master.master_id)}
            className="text-muted-foreground text-xs hover:text-foreground transition-colors"
          >
            {binding!.start_ms != null && binding!.end_ms != null ? "Adjust timeline" : "Set timeline"}
          </button>
        )}

        {status.hasExperience && status.hasMedia && master.canonical_type === "scene" && !status.hasRealization && (
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

  useEffect(() => {
    startRef.current = startMs;
    endRef.current = endMs;
    previewingRef.current = previewing;
  }, [endMs, previewing, startMs]);

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
    const result = await responseData(response);
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
    const result = await responseData(response);
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
  workTitle: string;
  onDone: () => void;
  onCancel: () => void;
};

function AttachVideoPanel({ projId, masterId, workTitle, onDone, onCancel }: AttachVideoPanelProps) {
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
          <p className={`text-sm ${/failed|could not|connection failed/i.test(uploadMsg) ? "text-destructive" : "text-foreground"}`}>
            {/failed|could not|connection failed/i.test(uploadMsg) ? uploadMsg : "✓ " + uploadMsg}
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
              }).then(responseData);

              if (session.error || !session.upload_url || !session.asset_id) {
                throw new Error(`${workTitle} — Video upload could not be started. ${session.error ?? "The upload session was incomplete."} Next: try the upload again.`);
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
                const status = await responseData(statusResponse);
                if (!statusResponse.ok || status.error) throw new Error(`${workTitle} — Video processing could not be verified. ${status.error ?? "The service returned an invalid processing status."} Next: retry processing or check the media service.`);
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
              }).then(responseData);

              if (attach.error) { setUploadMsg(`${workTitle} — Video connection failed. ${attach.error} Next: confirm the video and rights details, then retry.`); return; }
              setUploadMsg("Video attached. World and Moment are now playable.");
              setUploadFile(null); setRightsHolderRef(""); setRightsBasis(""); setUploadProgress(null); setUploadPhase(null); setUploadStage("ready");
              if (fileInputRef.current) fileInputRef.current.value = "";
              onDone();
            } catch (err) {
              setUploadMsg(`${workTitle} — Video upload failed. ${err instanceof Error ? err.message : "The upload could not be completed."}`);
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

function MediaIntakePanel({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [primaryArtistId, setPrimaryArtistId] = useState("");
  const [featuredArtistIds, setFeaturedArtistIds] = useState("");
  const [alternateTitle, setAlternateTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("");
  const [genre, setGenre] = useState("");
  const [subgenre, setSubgenre] = useState("");
  const [originalLanguage, setOriginalLanguage] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [contentRating, setContentRating] = useState("");
  const [searchStatus, setSearchStatus] = useState("pending");
  const [featured, setFeatured] = useState(false);
  const [releaseDate, setReleaseDate] = useState("");
  const [explicitContent, setExplicitContent] = useState(false);
  const [visibility, setVisibility] = useState("draft");
  const [altText, setAltText] = useState("");
  const [workType, setWorkType] = useState("animation");
  const [sourceType, setSourceType] = useState("upload");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceProvider, setSourceProvider] = useState("");
  const [externalIdentifier, setExternalIdentifier] = useState("");
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
      alternate_title: alternateTitle || null,
      description: description || null,
      short_description: shortDescription || null,
      original_language: originalLanguage || null,
      creator_name: creatorName || null,
      credits: [
        ...(primaryArtistId.trim() ? [{ participant_id: primaryArtistId.trim(), role: "primary_artist" }] : []),
        ...featuredArtistIds.split(",").map(value => value.trim()).filter(Boolean).map(participant_id => ({ participant_id, role: "featured_artist" })),
      ],
      work_type: workType,
      source_type: sourceType,
      source_url: sourceType === "external-url" ? sourceUrl : null,
      source_provider: sourceProvider || null,
      external_identifier: externalIdentifier || null,
      isrc: isrc || null,
      isrc_status: workType === "song" || workType === "audio" ? isrcStatus : "not-applicable",
      version_label: versionLabel || null,
      provenance_notes: provenanceNotes || null,
      language: language || null,
      genre: genre || null,
      subgenre: subgenre || null,
      release_date: releaseDate || null,
      original_release_date: null,
      content_rating: contentRating || null,
      explicit_content: explicitContent,
      visibility,
      search_status: searchStatus,
      featured,
      alt_text: altText || null,
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
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Content identity</p>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input value={creatorName} onChange={e => setCreatorName(e.target.value)} placeholder="Artist / creator" disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm" />
          <input value={alternateTitle} onChange={e => setAlternateTitle(e.target.value)} placeholder="Alternate title (optional)" disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm" />
        </div>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" disabled={busy} rows={2} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm resize-none" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input value={shortDescription} onChange={e => setShortDescription(e.target.value)} placeholder="Short description" disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm" />
          <input value={originalLanguage} onChange={e => setOriginalLanguage(e.target.value)} placeholder="Original language" disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm" />
        </div>
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
        <div className="grid grid-cols-2 gap-2">
          <input value={sourceProvider} onChange={e => setSourceProvider(e.target.value)} placeholder="Source / platform" disabled={busy} className="border-input bg-background text-foreground rounded-md border px-3 py-2 text-sm" />
          <input value={externalIdentifier} onChange={e => setExternalIdentifier(e.target.value)} placeholder="External ID (ISRC/URI)" disabled={busy} className="border-input bg-background text-foreground rounded-md border px-3 py-2 text-sm" />
        </div>
        {(workType === "song" || workType === "audio") && (
          <div className="grid grid-cols-2 gap-2">
            <select value={isrcStatus} onChange={e => setIsrcStatus(e.target.value)} disabled={busy} className="border-input bg-background text-foreground rounded-md border px-3 py-2 text-sm">
              <option value="verified">ISRC verified</option><option value="not-provided">Released but ISRC not provided</option><option value="not-applicable">Unreleased / no ISRC</option>
            </select>
            <input value={isrc} onChange={e => setIsrc(e.target.value.toUpperCase())} placeholder="ISRC" disabled={busy || isrcStatus !== "verified"} className="border-input bg-background text-foreground rounded-md border px-3 py-2 text-sm" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <input value={language} onChange={e => setLanguage(e.target.value)} placeholder="Language" disabled={busy} className="border-input bg-background text-foreground rounded-md border px-3 py-2 text-sm" />
          <input value={genre} onChange={e => setGenre(e.target.value)} placeholder="Genre / category" disabled={busy} className="border-input bg-background text-foreground rounded-md border px-3 py-2 text-sm" />
          <input value={subgenre} onChange={e => setSubgenre(e.target.value)} placeholder="Subgenre" disabled={busy} className="border-input bg-background text-foreground rounded-md border px-3 py-2 text-sm" />
          <input type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)} disabled={busy} className="border-input bg-background text-foreground rounded-md border px-3 py-2 text-sm" />
          <input value={contentRating} onChange={e => setContentRating(e.target.value)} placeholder="Content rating" disabled={busy} className="border-input bg-background text-foreground rounded-md border px-3 py-2 text-sm" />
          <select value={visibility} onChange={e => setVisibility(e.target.value)} disabled={busy} className="border-input bg-background text-foreground rounded-md border px-3 py-2 text-sm"><option value="draft">Draft</option><option value="private">Private</option><option value="public">Public</option></select>
        </div>
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Creative credits</p>
        <input value={primaryArtistId} onChange={e => setPrimaryArtistId(e.target.value)} placeholder="Primary artist participant ID" disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm" />
        <input value={featuredArtistIds} onChange={e => setFeaturedArtistIds(e.target.value)} placeholder="Featured artist participant IDs, comma separated" disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm" />
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Publishing</p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={explicitContent} onChange={e => setExplicitContent(e.target.checked)} disabled={busy} /> Explicit content</label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)} disabled={busy} /> Feature in discovery</label>
        <select value={searchStatus} onChange={e => setSearchStatus(e.target.value)} disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"><option value="pending">Search: pending</option><option value="indexed">Search: indexed</option><option value="excluded">Search: excluded</option></select>
        <input value={altText} onChange={e => setAltText(e.target.value)} placeholder="Artwork / thumbnail alt text" disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm" />
        <textarea value={provenanceNotes} onChange={e => setProvenanceNotes(e.target.value)} placeholder="Provenance / production notes" disabled={busy} rows={3} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm resize-none" />
        {message && <p className="text-destructive text-sm">{message}</p>}
        <Button size="sm" disabled={busy || !title.trim() || (sourceType === "external-url" && !sourceUrl.trim())} onClick={submit}>Create intake record</Button>
      </CardContent>
    </Card>
  );
}


// ─── Catalogue client (shared across Content / Production / Publishing / Rights) ─

type CatalogueFilter = "all" | "production" | "publishing" | "rights";

type CatalogueClientProps = { filter?: CatalogueFilter; heading: string; description: string };

export default function AuthorityCatalogueClient({ filter = "all", heading, description }: CatalogueClientProps) {
  const [data, setData] = useState<AuthorityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showIntake, setShowIntake] = useState(false);
  const [canonicalType, setCanonicalType] = useState<string>("universe");
  const [attachingProjId, setAttachingProjId] = useState<string | null>(null);
  const [attachingMasterId, setAttachingMasterId] = useState<string | null>(null);
  const [presentingMasterId, setPresentingMasterId] = useState<string | null>(null);
  const [presentingProjId, setPresentingProjId] = useState<string | null>(null);
  const [presentingProjMasterId, setPresentingProjMasterId] = useState<string | null>(null);
  const [editingTimelineBindingId, setEditingTimelineBindingId] = useState<string | null>(null);
  const [editingTimelineMasterId, setEditingTimelineMasterId] = useState<string | null>(null);
  const [editingRealizationBindingId, setEditingRealizationBindingId] = useState<string | null>(null);
  const [editingRealizationMasterId, setEditingRealizationMasterId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [cataloguePage, setCataloguePage] = useState(1);
  const router = useRouter();

  async function load() {
    const d = await api("/api/authority");
    if (d.error) { setError(d.error); return; }
    setData(d);
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);

  async function act(label: string, path: string, body: unknown, context?: { workTitle?: string; mediaTitle?: string }) {
    setBusy(true); setMsg(null);
    const d = await api(path, body);
    setBusy(false);
    if (d.error) { setMsg(operatorError(d.error, { ...context, operation: label })); return; }
    setMsg(`${label} succeeded.`);
    await load();
  }

  if (error) return <p className="text-destructive p-6 text-sm">{error}</p>;
  if (!data) return <p className="text-muted-foreground p-6 text-sm">Loading\u2026</p>;

  const { masters, states, projections, bindings, presentations, projectionPresentations, realizations, participants } = data;

  const workRecords: WorkRecord[] = masters.map(master => {
    const state = states.find(s => s.master_id === master.master_id);
    const projection = projections.find(p => p.master_id === master.master_id);
    const binding = projection ? bindings.find(b => b.projection_id === projection.projection_id) : undefined;
    const presentation = presentations.find(p => p.master_id === master.master_id);
    const projectionPresentation = projection ? projectionPresentations.find(p => p.projection_id === projection.projection_id) : undefined;
    return { master, state, projection, binding, presentation, projectionPresentation, status: getWorkStatus(master, state, projection, binding, presentation, projectionPresentation, realizations) };
  });

  const titleFor = (record: WorkRecord) => record.presentation?.title ?? record.projectionPresentation?.title ?? "Untitled work";
  const homeRoot = workRecords.find(r => r.master.parent_master_id === null && r.master.canonical_type === "universe" && !!r.presentation?.title);
  const homeIds = new Set<string>(homeRoot ? [homeRoot.master.master_id] : workRecords.map(r => r.master.master_id));
  if (homeRoot) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const record of workRecords) {
        if (record.master.parent_master_id && homeIds.has(record.master.parent_master_id) && !homeIds.has(record.master.master_id)) {
          homeIds.add(record.master.master_id);
          changed = true;
        }
      }
    }
  }
  const operationalRecords = workRecords.filter(r => homeIds.has(r.master.master_id));
  const baseRecords = filter === "production"
    ? operationalRecords.filter(r => r.master.canonical_type === "scene" || r.master.canonical_type === "mural")
    : filter === "publishing"
    ? operationalRecords.filter(r => r.status.ready || r.status.hasExperience)
    : filter === "rights"
    ? operationalRecords.filter(r => r.status.playable)
    : operationalRecords;
  const matchingRecords = baseRecords.filter(r => titleFor(r).toLowerCase().includes(query.toLowerCase()) && (typeFilter === "all" || r.master.canonical_type === typeFilter));
  const cataloguePageSize = 8;
  const cataloguePageCount = Math.max(1, Math.ceil(matchingRecords.length / cataloguePageSize));
  const currentCataloguePage = Math.min(cataloguePage, cataloguePageCount);
  const visibleRecords = matchingRecords.slice((currentCataloguePage - 1) * cataloguePageSize, currentCataloguePage * cataloguePageSize);
  const statusLabel = (record: WorkRecord) => record.status.ready ? "Ready to publish" : record.status.needs;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Mighty Verse</span><ChevronRight size={13} /><span>Authority</span></div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{heading}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground md:flex"><Search size={14} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search..." className="w-40 bg-transparent outline-none placeholder:text-muted-foreground" /></div>
          <Button size="sm" onClick={() => setShowRegister(true)}><Plus size={14} /> New work</Button>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mt-1 text-sm text-muted-foreground">{matchingRecords.length ? `Showing ${(currentCataloguePage - 1) * cataloguePageSize + 1}\u2013${Math.min(currentCataloguePage * cataloguePageSize, matchingRecords.length)} of ${matchingRecords.length} works` : "No works match this search."}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs md:hidden"><Search size={14} /><input value={query} onChange={e => { setQuery(e.target.value); setCataloguePage(1); }} placeholder="Search..." className="w-28 bg-transparent outline-none" /></div>
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setCataloguePage(1); }} className="h-8 rounded-md border border-border bg-card px-2 text-xs"><option value="all">All types</option>{Object.entries(WORK_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <Button size="sm" variant="outline" onClick={() => setShowIntake(true)}><Upload size={14} /> Media intake</Button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Work</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Media</th><th className="px-4 py-3 font-medium">Experience</th><th className="px-4 py-3 font-medium">Rights</th><th className="px-4 py-3" /></tr></thead>
            <tbody className="divide-y divide-border">
              {visibleRecords.map(record => (
                <tr key={record.master.master_id} className="cursor-pointer hover:bg-muted/30" onClick={() => router.push(`/authority/${record.master.master_id}`)}>
                  <td className="px-4 py-3 font-medium">{titleFor(record)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{WORK_TYPE_LABELS[record.master.canonical_type]}</td>
                  <td className="px-4 py-3"><Badge variant={record.status.ready ? "secondary" : "outline"}>{statusLabel(record)}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{record.status.playable ? "Playable" : record.status.hasMedia ? "Processing" : "Missing"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{record.status.hasExperience ? "Created" : "Missing"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{record.status.rightsVerified ? "Verified" : "Review"}</td>
                  <td className="px-4 py-3 text-right"><ChevronRight size={16} className="inline text-muted-foreground" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleRecords.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No works match this search.</p>}
        </div>
        {cataloguePageCount > 1 && <div className="flex items-center justify-between"><Button size="sm" variant="outline" disabled={currentCataloguePage === 1} onClick={() => setCataloguePage(p => Math.max(1, p - 1))}>Previous</Button><span className="text-xs text-muted-foreground">Page {currentCataloguePage} of {cataloguePageCount}</span><Button size="sm" variant="outline" disabled={currentCataloguePage === cataloguePageCount} onClick={() => setCataloguePage(p => Math.min(cataloguePageCount, p + 1))}>Next</Button></div>}
      </section>

      {showRegister && (
        <Card><CardContent className="pt-4 space-y-3">
          <div className="flex items-center justify-between"><span className="text-foreground text-sm font-medium">Register New Work</span><button type="button" onClick={() => setShowRegister(false)} className="text-muted-foreground text-xs hover:text-foreground">Cancel</button></div>
          <select value={canonicalType} onChange={e => setCanonicalType(e.target.value)} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm">{CANONICAL_TYPES.map(t => <option key={t} value={t}>{WORK_TYPE_LABELS[t]}</option>)}</select>
          <Button size="sm" disabled={busy} onClick={async () => { await act("Register Work", "/api/authority/masters", { canonical_type: canonicalType }); setShowRegister(false); }}>Register Work</Button>
        </CardContent></Card>
      )}

      {showIntake && <MediaIntakePanel onDone={async () => { setShowIntake(false); await load(); }} onCancel={() => setShowIntake(false)} />}
      {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-destructive" : "text-foreground"}`}>{msg}</p>}
    </div>
  );
}

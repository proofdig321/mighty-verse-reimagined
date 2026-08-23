"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Archive, BarChart3, ChevronRight, Database, FileText, Image, LayoutDashboard, Menu, MoreHorizontal, PlaySquare, Plus, Search, Settings, ShieldCheck, Upload, Users, Video, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
};

const WORK_TYPE_LABELS: Record<string, string> = {
  "universe": "Universe",
  "creative-moment": "Creative Moment",
  "mural": "Mural",
  "scene": "Scene",
  "interpretation": "Interpretation",
  "other": "Other",
};

const EXPERIENCE_TYPE_LABELS: Record<string, string> = {
  "experiential": "Experiential",
  "distributional": "Distributional",
  "archival": "Archival",
  "other": "Other",
};

const CANONICAL_TYPES = ["universe", "creative-moment", "mural", "scene", "interpretation", "other"] as const;
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

type JourneyStep = { label: string; state: "complete" | "current" | "blocked" | "optional" | "not-applicable" };

function getJourneySteps(master: AuthorityData["masters"][number], status: WorkStatus): JourneyStep[] {
  const realizationRequired = master.canonical_type === "scene";
  const mediaRequired = master.canonical_type !== "creative-moment";
  const rightsState = !status.playable ? "not-applicable" : status.rightsVerified ? "complete" : "blocked";
  return [
    { label: "Work", state: "complete" },
    { label: "Authorised", state: status.hasState ? "complete" : "current" },
    { label: "Experience", state: status.hasExperience ? "complete" : status.hasState ? "current" : "not-applicable" },
    { label: "Media", state: !mediaRequired ? "not-applicable" : status.playable ? "complete" : status.hasExperience ? "current" : "not-applicable" },
    { label: "Rights", state: rightsState },
    { label: "Artwork", state: status.hasArtwork ? "complete" : "optional" },
    { label: "Timeline", state: master.canonical_type !== "scene" ? "not-applicable" : status.needsTimeline ? status.hasMedia ? "current" : "not-applicable" : "complete" },
    { label: "Production version", state: !realizationRequired ? "not-applicable" : status.hasRealization ? "complete" : status.playable ? "current" : "not-applicable" },
    { label: "Ready", state: status.ready ? "complete" : "current" },
  ];
}

function getNextAction(master: AuthorityData["masters"][number], status: WorkStatus) {
  if (!status.hasState) return "Authorise work";
  if (!status.hasExperience) return "Create experience";
  if (master.canonical_type !== "creative-moment" && !status.playable) return "Attach media";
  if (status.needsTimeline) return "Set timeline";
  if (status.playable && !status.rightsVerified) return "Review rights";
  if (master.canonical_type === "scene" && !status.hasRealization) return "Record production version";
  return status.ready ? "Review publication" : "Verify readiness";
}

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
  const realizationRequired = master.canonical_type === "scene";
  const mediaRequired = master.canonical_type !== "creative-moment";
  // Artwork, realization, and rights are surfaced as operational context. They
  // are not universal blockers: the operating requirement is determined by the
  // kind of work and the experience it is meant to deliver.
  const needs = !hasState
    ? "Needs authorisation"
    : !hasExperience
    ? "Needs experience"
    : mediaRequired && (!hasMedia || !playable)
    ? "Needs media"
    : !hasTimeline
    ? "Needs timeline"
    : "Ready";
  const operationalNeeds = needs !== "Ready"
    ? needs
    : playable && !rightsVerified
    ? "Needs rights review"
    : !hasTimeline
    ? "Needs timeline"
    : realizationRequired && !hasRealization
    ? "Needs production version"
    : "Ready";
  return { ready: operationalNeeds === "Ready", needs: operationalNeeds, hasState, hasExperience, hasMedia, playable, hasArtwork, needsTimeline: !hasTimeline, hasRealization, rightsVerified };
}

function StatusBadge({ label, good = false }: { label: string; good?: boolean }) {
  return <Badge variant={good ? "secondary" : "outline"}>{label}</Badge>;
}

function operatorError(value: unknown, context?: { workTitle?: string; operation?: string; mediaTitle?: string }) {
  const message = String(value ?? "");
  const prefix = context?.workTitle && context.operation ? `${context.workTitle} — ${context.operation}: ` : "";
  if (/collectible designation blocked/i.test(message)) {
    const media = context?.mediaTitle ? ` Video: ${context.mediaTitle}.` : "";
    return `${prefix}Collectible designation is blocked because the attached video does not have a confirmed rights holder.${media} Next: establish the video's rights before designating it as collectible.`;
  }
  if (/uuid|participant/i.test(message)) return `${prefix}The selected participant could not be identified as a registered Mighty Verse participant. Next: select a registered participant and try again.`;
  if (/rights holder|rights basis|unknown rights/i.test(message)) return `${prefix}The attached video does not yet have a confirmed rights holder. Next: establish the video's rights before continuing.`;
  if (/json|unexpected end|incomplete response/i.test(message)) return `${prefix}The service returned an incomplete response. Next: retry the operation.`;
  return `${prefix}${message || "The operation could not be completed."} Next: review the work details and try again.`;
}

async function api(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const responseText = await res.text();
  try {
    return { ...JSON.parse(responseText), status: res.status };
  } catch {
    return { error: `The service returned no readable response (HTTP ${res.status}).`, status: res.status };
  }
}

async function responseData(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: `The service returned no readable response (HTTP ${response.status}).` };
  }
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
  const [expType, setExpType] = useState("experiential");
  const typeLabel = WORK_TYPE_LABELS[master.canonical_type] ?? master.canonical_type;
  const status = getWorkStatus(master, state, projection, binding, presentation, projectionPresentation, realizations);
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
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Production journey</p>
          <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
            {journey.map((step, index) => (
              <div key={step.label} className="flex items-center gap-1">
                {index > 0 && <span className="px-0.5 text-muted-foreground/50">→</span>}
                <span className={`text-xs ${step.state === "complete" ? "text-foreground" : step.state === "blocked" ? "font-medium text-destructive" : step.state === "current" ? "font-medium text-foreground" : "text-muted-foreground/60"}`}>
                  {step.state === "complete" ? "✓ " : step.state === "blocked" ? "! " : step.state === "not-applicable" ? "— " : step.state === "optional" ? "· " : "○ "}{step.label}{step.state === "optional" ? " (optional)" : ""}
                </span>
              </div>
            ))}
          </div>
          {!status.ready && <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Next step:</span> {nextStep}</p>}
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
  workTitle,
  participants,
  onDone,
  onCancel,
}: {
  binding: AuthorityData["bindings"][number];
  masterId: string;
  workTitle: string;
  participants: AuthorityData["participants"];
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
    if (created.error) { setBusy(false); setMessage(`${workTitle} — Production version: ${created.error} Next: select a registered participant.`); return; }
    const bound = await fetch("/api/authority/media-realization/bind", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ binding_id: binding.binding_id, master_id: masterId, realization_id: created.realization_id }),
    }).then(responseData);
    setBusy(false);
    if (bound.error) { setMessage(`${workTitle} — Production version: ${bound.error} Next: verify the selected production details.`); return; }
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
        <select value={rightsHolderRef} onChange={e => setRightsHolderRef(e.target.value)} disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm">
          <option value="">Select rights owner</option>
          {participants.map(participant => <option key={participant.participant_id} value={participant.participant_id}>{participant.label}</option>)}
        </select>
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
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [cataloguePage, setCataloguePage] = useState(1);
  const [activeModule, setActiveModule] = useState<"dashboard" | "content" | "production" | "publishing" | "rights">("dashboard");

  async function load() {
    const d = await api("/api/authority");
    if (d.error) { setError(d.error); return; }
    setData(d);
  }

  // The fetch resolves outside React; its completion updates the read model.
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
  if (!data) return <p className="text-muted-foreground p-6 text-sm">Loading…</p>;

  const { authority, masters, states, projections, bindings, presentations, projectionPresentations, realizations, participants } = data;

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

  const titleFor = (record: WorkRecord) => record.presentation?.title ?? record.projectionPresentation?.title ?? "Untitled work";
  const homeRoot = workRecords.find(record => record.master.parent_master_id === null && record.master.canonical_type === "universe" && !!record.presentation?.title);
  const homeIds = new Set<string>(homeRoot ? [homeRoot.master.master_id] : workRecords.map(record => record.master.master_id));
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
  const operationalRecords = workRecords.filter(record => homeIds.has(record.master.master_id));
  const matchingRecords = operationalRecords.filter(record => titleFor(record).toLowerCase().includes(query.toLowerCase()) && (typeFilter === "all" || record.master.canonical_type === typeFilter));
  const moduleRecords = activeModule === "production"
    ? matchingRecords.filter(record => record.master.canonical_type === "scene" || record.master.canonical_type === "mural")
    : activeModule === "publishing"
    ? matchingRecords.filter(record => record.status.ready || record.status.hasExperience)
    : activeModule === "rights"
    ? matchingRecords.filter(record => record.status.playable)
    : matchingRecords;
  const cataloguePageSize = 8;
  const cataloguePageCount = Math.max(1, Math.ceil(moduleRecords.length / cataloguePageSize));
  const currentCataloguePage = Math.min(cataloguePage, cataloguePageCount);
  const visibleRecords = moduleRecords.slice((currentCataloguePage - 1) * cataloguePageSize, currentCataloguePage * cataloguePageSize);
  const orderedRecords = visibleRecords;
  const selected = operationalRecords.find(record => record.master.master_id === selectedId) ?? null;
  const attention = operationalRecords.flatMap(record => {
    const issues: { record: WorkRecord; label: string; detail: string; action: string }[] = [];
    const name = titleFor(record);
    if (!record.status.hasState) issues.push({ record, label: "Needs authorisation", detail: `${name} is registered but has not been authorised for publishing.`, action: "Authorise work" });
    else if (!record.status.hasExperience) issues.push({ record, label: "Needs experience", detail: `${name} has an authorised identity but no publishing experience.`, action: "Create experience" });
    else if (record.master.canonical_type !== "creative-moment" && !record.status.playable) issues.push({ record, label: "Video", detail: `${name} needs a playable video to continue publishing.`, action: "Add video" });
    if (record.status.needsTimeline && record.status.hasMedia) issues.push({ record, label: "Timeline", detail: `${name} needs a playback range before it can be reviewed.`, action: "Set timeline" });
    if (record.master.canonical_type === "scene" && record.status.playable && !record.status.needsTimeline && !record.status.hasRealization) issues.push({ record, label: "Production version", detail: `${name} has playable media and a complete timeline, but its production version has not been recorded.`, action: "Record production version" });
    return issues;
  });
  const statusLabel = (record: WorkRecord) => record.status.ready ? "Ready to publish" : record.status.needs;
  const hasSupportedNextAction = (record: WorkRecord) =>
    !record.status.hasState ||
    !record.status.hasExperience ||
    (!record.status.playable && record.projection != null) ||
    (record.status.needsTimeline && record.binding != null) ||
    (record.master.canonical_type === "scene" && !record.status.hasRealization && record.binding != null);
  const nextAction = (record: WorkRecord) => hasSupportedNextAction(record) ? getNextAction(record.master, record.status) : "No action available";
  const runNextAction = (record: WorkRecord) => {
    if (!hasSupportedNextAction(record)) return Promise.resolve();
    if (!record.status.hasState) return act("Authorise Work", "/api/authority/states", { master_id: record.master.master_id });
    if (!record.status.hasExperience) return act("Create Experience", "/api/authority/projections", { canonical_state_id: record.state!.canonical_state_id, master_id: record.master.master_id, projection_type: "experiential" });
    if (!record.status.playable && record.projection) { setAttachingProjId(record.projection.projection_id); setAttachingMasterId(record.master.master_id); return Promise.resolve(); }
    if (record.status.needsTimeline && record.binding) { setEditingTimelineBindingId(record.binding.binding_id); setEditingTimelineMasterId(record.master.master_id); return Promise.resolve(); }
    if (record.master.canonical_type === "scene" && !record.status.hasRealization && record.binding) { setEditingRealizationBindingId(record.binding.binding_id); setEditingRealizationMasterId(record.master.master_id); return Promise.resolve(); }
    return Promise.resolve();
  };

  const overviewMetrics: Array<[string, string, typeof Archive]> = [["Universes", "universe", Archive], ["Murals", "mural", Image], ["Creative Moments", "creative-moment", FileText], ["Scenes", "scene", PlaySquare], ["Registered", "all", Database], ["Authorised", "state", ShieldCheck], ["With Experience", "experience", PlaySquare], ["Playable", "playable", Video], ["Collectible", "collectible", BarChart3], ["Needs attention", "attention", Activity]];
  const navGroups = [{ label: "Workspace", links: [["Dashboard", "dashboard", LayoutDashboard], ["Content", "content", Archive], ["Production", "production", Activity], ["Publishing", "publishing", BarChart3], ["Rights", "rights", ShieldCheck]] }, { label: "Tools", links: [["Media intake", "media", Upload], ["Technical details", "technical", Database]] }] as const;
  return (
    <div className="min-h-screen bg-muted/30 lg:flex">
      <aside className={`${mobileNav ? "block" : "hidden"} fixed inset-y-0 left-0 z-20 w-64 border-r border-border bg-card p-5 lg:static lg:block lg:min-h-screen`}>
        <div className="mb-8 flex items-start justify-between"><div><p className="text-sm font-semibold tracking-tight">Mighty Verse</p><p className="mt-1 text-xs text-muted-foreground">Authority Console</p></div><button className="lg:hidden" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={16} /></button></div>
        <nav className="space-y-6">{navGroups.map(group => <div key={group.label}><p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{group.label}</p><div className="space-y-0.5">{group.links.map(([label, target, Icon]) => <button key={label} type="button" onClick={() => { if (target === "media") setShowIntake(true); else if (target === "technical") document.getElementById("canonical")?.scrollIntoView({ behavior: "smooth" }); else setActiveModule(target as typeof activeModule); setSelectedId(null); setMobileNav(false); }} className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs ${activeModule === target ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Icon size={14} />{label}</button>)}</div></div>)}</nav>
        <div className="mt-10 border-t border-border pt-4"><div className="flex items-center gap-2 px-2 text-xs text-muted-foreground"><Users size={14} />{authority.scope_type} scope</div></div>
      </aside>
      <main className="mx-auto w-full max-w-[1500px] flex-1 space-y-8 p-4 sm:p-6 lg:px-10">
        <header className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><button className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button><div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Mighty Verse</span><ChevronRight size={13} /><span>Authority</span></div><h1 className="mt-2 text-2xl font-semibold tracking-tight">Dashboard</h1></div></div><div className="flex items-center gap-2"><div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground md:flex"><Search size={14} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search catalogue..." className="w-40 bg-transparent outline-none placeholder:text-muted-foreground" /></div><Button size="sm" onClick={() => setShowRegister(true)}><Plus size={14} /> New work</Button><button className="rounded-md border border-border bg-card p-2 text-muted-foreground" aria-label="More actions"><MoreHorizontal size={16} /></button></div></header>

      {activeModule === "dashboard" && <section id="attention" className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <Card className="border-0 shadow-sm"><CardContent className="space-y-4 pt-5"><div className="flex items-start justify-between"><div><h2 className="text-base font-semibold">Needs attention</h2><p className="mt-1 text-sm text-muted-foreground">The next useful action for incomplete work.</p></div><Badge variant="outline">{attention.length} items</Badge></div>{attention.length === 0 ? <p className="border-t border-border pt-4 text-sm text-muted-foreground">Everything in the catalogue is ready for review.</p> : <div className="divide-y divide-border">{attention.slice(0, 6).map((item, index) => <div key={`${item.record.master.master_id}-${item.label}-${index}`} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{titleFor(item.record)}</p><div className="mt-1 flex flex-wrap items-center gap-2"><Badge variant="outline">{WORK_TYPE_LABELS[item.record.master.canonical_type]}</Badge><span className="text-xs text-muted-foreground">{item.label}</span></div><p className="mt-1 text-xs text-muted-foreground">{item.detail}</p></div><Button size="sm" variant="outline" onClick={() => { setSelectedId(item.record.master.master_id); void runNextAction(item.record); }}>{item.action}</Button></div>)}</div>}</CardContent></Card>
        <Card className="border-0 bg-primary text-primary-foreground shadow-sm"><CardContent className="space-y-5 pt-5"><div><p className="text-xs uppercase tracking-widest text-primary-foreground/60">Publishing readiness</p><p className="mt-2 text-4xl font-semibold">{workRecords.length ? Math.round(workRecords.filter(r => r.status.ready).length / workRecords.length * 100) : 0}%</p><p className="mt-1 text-sm text-primary-foreground/70">{workRecords.filter(r => r.status.ready).length} of {workRecords.length} works ready to publish</p></div><div className="h-2 overflow-hidden rounded-full bg-primary-foreground/20"><div className="h-full bg-accent-mv transition-all" style={{ width: `${workRecords.length ? workRecords.filter(r => r.status.ready).length / workRecords.length * 100 : 0}%` }} /></div><p className="text-xs text-primary-foreground/60">Readiness is calculated from the live catalogue.</p></CardContent></Card>
      </section>}

      <section id="catalogue" className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Catalogue</h2><p className="mt-1 text-sm text-muted-foreground">{matchingRecords.length ? `Showing ${(currentCataloguePage - 1) * cataloguePageSize + 1}–${Math.min(currentCataloguePage * cataloguePageSize, matchingRecords.length)} of ${matchingRecords.length} works` : "No works match this search."}</p></div><div className="flex items-center gap-2"><div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs md:hidden"><Search size={14} /><input value={query} onChange={e => { setQuery(e.target.value); setCataloguePage(1); }} placeholder="Search..." className="w-28 bg-transparent outline-none" /></div><select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setCataloguePage(1); }} className="h-8 rounded-md border border-border bg-card px-2 text-xs"><option value="all">All types</option>{Object.entries(WORK_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Button size="sm" variant="outline" onClick={() => setShowIntake(true)}><Upload size={14} /> Media intake</Button></div></div><div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Work</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Media</th><th className="px-4 py-3 font-medium">Experience</th><th className="px-4 py-3 font-medium">Rights</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-border">{visibleRecords.map(record => <tr key={record.master.master_id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedId(record.master.master_id)}><td className="px-4 py-3 font-medium">{titleFor(record)}</td><td className="px-4 py-3 text-muted-foreground">{WORK_TYPE_LABELS[record.master.canonical_type]}</td><td className="px-4 py-3"><Badge variant={record.status.ready ? "secondary" : "outline"}>{statusLabel(record)}</Badge></td><td className="px-4 py-3 text-muted-foreground">{record.status.playable ? "Playable" : record.status.hasMedia ? "Processing" : "Missing"}</td><td className="px-4 py-3 text-muted-foreground">{record.status.hasExperience ? "Created" : "Missing"}</td><td className="px-4 py-3 text-muted-foreground">{record.status.rightsVerified ? "Verified" : "Review"}</td><td className="px-4 py-3 text-right"><ChevronRight size={16} className="inline text-muted-foreground" /></td></tr>)}</tbody></table>{visibleRecords.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No works match this search.</p>}</div>{cataloguePageCount > 1 && <div className="flex items-center justify-between"><Button size="sm" variant="outline" disabled={currentCataloguePage === 1} onClick={() => setCataloguePage(page => Math.max(1, page - 1))}>Previous</Button><span className="text-xs text-muted-foreground">Page {currentCataloguePage} of {cataloguePageCount}</span><Button size="sm" variant="outline" disabled={currentCataloguePage === cataloguePageCount} onClick={() => setCataloguePage(page => Math.min(cataloguePageCount, page + 1))}>Next</Button></div>}</section>

      {selected && <section className="grid gap-5 xl:grid-cols-[1fr_320px]"><Card className="border-0 shadow-sm"><CardContent className="space-y-6 pt-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Badge variant="outline">{WORK_TYPE_LABELS[selected.master.canonical_type]}</Badge><Badge variant={selected.status.ready ? "secondary" : "outline"}>{statusLabel(selected)}</Badge></div><h2 className="mt-3 text-2xl font-semibold">{titleFor(selected)}</h2><p className="mt-1 text-sm text-muted-foreground">Work management and publishing journey</p></div><div className="flex gap-2"><Button size="sm" onClick={() => void runNextAction(selected)} disabled={busy || !hasSupportedNextAction(selected)} title={!hasSupportedNextAction(selected) ? "No supported operation is available for this step" : undefined}>{nextAction(selected)}</Button><button className="rounded-md border border-border p-2 text-muted-foreground" aria-label="Close work detail" onClick={() => setSelectedId(null)}><X size={16} /></button></div></div><div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{[["Identity", selected.status.hasState], ["Rights", selected.status.rightsVerified], ["Experience", selected.status.hasExperience], ["Media", selected.status.playable], ["Artwork", selected.status.hasArtwork], ["Timeline", !selected.status.needsTimeline]].map(([label, complete]) => <div key={label as string} className={`rounded-md border p-3 ${complete ? "border-accent-mv/50 bg-accent-mv/10" : "border-border"}`}><div className={`mb-2 h-1.5 rounded-full ${complete ? "bg-accent-mv" : "bg-muted"}`} /><p className="text-xs font-medium">{label}</p><p className="mt-1 text-[10px] text-muted-foreground">{complete ? "Complete" : "Next"}</p></div>)}</div><div className="grid gap-3 sm:grid-cols-3"><Card size="sm"><CardContent className="space-y-2 pt-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overview</p><p className="text-sm">{selected.presentation?.description ?? "No description has been added yet."}</p></CardContent></Card><Card size="sm"><CardContent className="space-y-2 pt-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Media</p><p className="text-sm">{selected.status.playable ? "Playable media attached" : "No playable media attached"}</p><Button size="sm" variant="outline" disabled={!selected.projection} onClick={() => { if (selected.projection) { setAttachingProjId(selected.projection.projection_id); setAttachingMasterId(selected.master.master_id); } }}>{selected.status.playable ? "Replace media" : "Attach media"}</Button></CardContent></Card><Card size="sm"><CardContent className="space-y-2 pt-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Presentation</p><p className="text-sm">{selected.status.hasArtwork ? "Artwork ready" : "Artwork not available"}</p><Button size="sm" variant="outline" onClick={() => setPresentingMasterId(selected.master.master_id)}>Edit artwork &amp; title</Button></CardContent></Card></div>{selected.master.canonical_type === "scene" && selected.binding && <Button size="sm" variant="outline" onClick={() => { setEditingTimelineBindingId(selected.binding!.binding_id); setEditingTimelineMasterId(selected.master.master_id); }}>Set timeline</Button>}</CardContent></Card><Card className="border-0 shadow-sm"><CardContent className="space-y-4 pt-5"><div><h3 className="text-sm font-semibold">Technical details</h3><p className="mt-1 text-xs text-muted-foreground">Canonical and verification records for authorised operators.</p></div><details className="text-xs"><summary className="cursor-pointer font-medium">View canonical record</summary><div className="mt-3 space-y-2 font-mono text-muted-foreground"><p>Master: {shortId(selected.master.master_id)}…</p><p>State: {selected.state ? `${shortId(selected.state.canonical_state_id)}… · v${selected.state.version}` : "None"}</p><p>Experience: {selected.projection ? `${shortId(selected.projection.projection_id)}…` : "None"}</p><p>Media: {selected.binding ? `${shortId(selected.binding.asset_id)}…` : "None"}</p><p>Realization: {selected.binding?.realization_id ? `${shortId(selected.binding.realization_id)}…` : "None"}</p></div></details></CardContent></Card></section>}

      <div className="hidden">
      {/* Header */}
      <section id="overview" className="space-y-5"><div><p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Catalogue pulse</p><p className="mt-1 text-sm text-muted-foreground">A live view of what exists and what is ready for publishing.</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{overviewMetrics.map(([label, key, Icon]) => { const count = key === "all" ? workRecords.length : key === "state" ? workRecords.filter(r => r.status.hasState).length : key === "experience" ? workRecords.filter(r => r.status.hasExperience).length : key === "playable" ? workRecords.filter(r => r.status.playable).length : key === "collectible" ? projections.filter(p => p.collectible_designated).length : key === "attention" ? attention.length : workRecords.filter(r => r.master.canonical_type === key).length; return <Card key={label} size="sm"><CardContent className="flex items-center justify-between pt-4"><div><p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{count}</p></div><Icon size={18} className="text-muted-foreground" /></CardContent></Card>; })}</div></section>

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

      {(selected ? [] : orderedRecords).map((record, index) => {
        const { master, state, projection, binding, presentation, projectionPresentation } = record;
        const previousType = orderedRecords[index - 1]?.master.canonical_type;
        const isGroupStart = previousType !== master.canonical_type;

        // Projection presentation panel open for this projection
        if (presentingProjId === projection?.projection_id) {
          return (
            <div key={master.master_id} className="space-y-2">
              {isGroupStart && <h3 id={`${master.canonical_type}s`} className="pt-4 text-muted-foreground text-xs font-medium uppercase tracking-widest">{WORK_TYPE_LABELS[master.canonical_type] ?? master.canonical_type}s</h3>}
              <ProjectionPresentationPanel projectionId={presentingProjId!} masterId={presentingProjMasterId!} existing={projectionPresentation} onDone={async () => { setPresentingProjId(null); setPresentingProjMasterId(null); await load(); }} onCancel={() => { setPresentingProjId(null); setPresentingProjMasterId(null); }} />
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
              <AttachVideoPanel projId={attachingProjId!} masterId={attachingMasterId!} workTitle={titleFor(record)} onDone={async () => { setAttachingProjId(null); setAttachingMasterId(null); await load(); }} onCancel={() => { setAttachingProjId(null); setAttachingMasterId(null); }} />
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
              <RealizationPanel binding={binding} masterId={editingRealizationMasterId!} workTitle={titleFor(record)} participants={participants} onDone={async () => { setEditingRealizationBindingId(null); setEditingRealizationMasterId(null); await load(); }} onCancel={() => { setEditingRealizationBindingId(null); setEditingRealizationMasterId(null); }} />
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
            onDesignate={(projId, masterId, workTitle) =>
              act("Collectible setup", "/api/authority/collectibles", { projection_id: projId, master_id: masterId }, { workTitle, mediaTitle: "Attached video" })
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
      </div>
      </main>
    </div>
  );
}

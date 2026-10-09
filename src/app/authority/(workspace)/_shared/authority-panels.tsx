"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, responseData, PROJECTION_TYPES, EXPERIENCE_TYPE_LABELS, formatTimelineMs, type JourneyStep } from "./authority-utils";
import { SecondsField } from "@/components/assemble/seconds-field";
import { StudioFormPanel } from "@/components/assemble/studio-form-panel";
import { StudioField, studioInputClass, studioTextareaClass, studioSelectClass } from "@/components/assemble/studio-field";
import { StudioFeedback } from "@/components/assemble/studio-feedback";

// ─── StatusBadge ─────────────────────────────────────────────────────────────

export function StatusBadge({ label, good = false }: { label: string; good?: boolean }) {
  return <Badge variant={good ? "secondary" : "outline"}>{label}</Badge>;
}

// ─── WorkJourney ─────────────────────────────────────────────────────────────

export function WorkJourney({ steps }: { steps: JourneyStep[] }) {
  return (
    <div className="studio-composer">
      <p className="suite-kicker">Publishing journey</p>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-1">
            {i > 0 && <span className="px-0.5 text-muted-foreground/50">→</span>}
            <span
              className={`text-xs ${
                step.state === "complete"
                  ? "text-foreground"
                  : step.state === "blocked"
                  ? "font-medium text-destructive"
                  : step.state === "current"
                  ? "font-medium text-foreground"
                  : "text-muted-foreground/60"
              }`}
            >
              {step.state === "complete"
                ? "✓ "
                : step.state === "blocked"
                ? "! "
                : step.state === "not-applicable"
                ? "— "
                : step.state === "optional"
                ? "· "
                : "○ "}
              {step.label}
              {step.state === "optional" ? " (optional)" : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PresentationPanel ────────────────────────────────────────────────────────

type PresentationPanelProps = {
  masterId: string;
  existing: { title: string; description: string | null; description_md?: string | null; artwork_asset_id?: string | null } | undefined | null;
  onDone: () => void;
  onCancel: () => void;
};

export function PresentationPanel({ masterId, existing, onDone, onCancel }: PresentationPanelProps) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [descriptionMd, setDescriptionMd] = useState(existing?.description_md ?? "");
  const [artworkAssetId, setArtworkAssetId] = useState(existing?.artwork_asset_id ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <StudioFormPanel title="Presentation" onCancel={!busy ? onCancel : undefined}>
      <div className="grid gap-3">
        <StudioField label="Title">
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
            className={studioInputClass}
          />
        </StudioField>
        <StudioField label="Short description">
          <textarea
            placeholder="Short description (plain text)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={busy}
            rows={2}
            className={studioTextareaClass}
          />
        </StudioField>
        <StudioField
          label="Editorial description"
          hint="Supports **bold**, _italic_, headings, lists, links. Renders on web, strips to plain text for distribution copy."
        >
          <textarea
            placeholder="Full editorial description (Markdown)"
            value={descriptionMd}
            onChange={(e) => setDescriptionMd(e.target.value)}
            disabled={busy}
            rows={5}
            className={`${studioTextareaClass} font-mono resize-y`}
          />
        </StudioField>
        <StudioField label="Representative artwork asset ID" hint="Optional">
          <input
            type="text"
            placeholder="asset ID"
            value={artworkAssetId}
            onChange={(e) => setArtworkAssetId(e.target.value)}
            disabled={busy}
            className={studioInputClass}
          />
        </StudioField>
        <StudioFeedback message={msg} />
        <Button
          size="sm"
          disabled={busy || !title.trim()}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            const res = await api("/api/authority/presentation", {
              master_id: masterId,
              title,
              description: description || null,
              description_md: descriptionMd || null,
              artwork_asset_id: artworkAssetId || null,
            });
            setBusy(false);
            if (res.error) { setMsg(`Error: ${res.error}`); return; }
            onDone();
          }}
        >
          Save
        </Button>
      </div>
    </StudioFormPanel>
  );
}

// ─── ProjectionPresentationPanel ──────────────────────────────────────────────

type ProjectionPresentationPanelProps = {
  projectionId: string;
  masterId: string;
  existing: { title: string; description: string | null; artwork_asset_id?: string | null } | undefined | null;
  onDone: () => void;
  onCancel: () => void;
};

export function ProjectionPresentationPanel({ projectionId, masterId, existing, onDone, onCancel }: ProjectionPresentationPanelProps) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [artworkAssetId, setArtworkAssetId] = useState(existing?.artwork_asset_id ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <StudioFormPanel title="Moment Presentation" onCancel={!busy ? onCancel : undefined}>
      <div className="grid gap-3">
        <StudioField label="Title">
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
            className={studioInputClass}
          />
        </StudioField>
        <StudioField label="Description" hint="Optional">
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={busy}
            rows={3}
            className={studioTextareaClass}
          />
        </StudioField>
        <StudioField label="Representative artwork asset ID" hint="Optional">
          <input
            type="text"
            placeholder="asset ID"
            value={artworkAssetId}
            onChange={(e) => setArtworkAssetId(e.target.value)}
            disabled={busy}
            className={studioInputClass}
          />
        </StudioField>
        <StudioFeedback message={msg} />
        <Button
          size="sm"
          disabled={busy || !title.trim()}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
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
      </div>
    </StudioFormPanel>
  );
}

// ─── RealizationPanel ─────────────────────────────────────────────────────────

type RealizationPanelProps = {
  bindingId: string;
  masterId: string;
  workTitle: string;
  participants: { participant_id: string; label: string }[];
  onDone: () => void;
  onCancel: () => void;
};

const REALIZATION_TYPES = [
  { value: "music-video", label: "Music video recording (ISRC-eligible)" },
  { value: "original-recording", label: "Original recording (ISRC-eligible)" },
  { value: "live-performance", label: "Live performance recording (ISRC-eligible)" },
  { value: "broadcast-recording", label: "Broadcast recording (ISRC-eligible)" },
  { value: "animated-video", label: "Animated video" },
  { value: "visualisation", label: "Visualisation" },
  { value: "other", label: "Other" },
] as const;

export function RealizationPanel({ bindingId, masterId, workTitle, participants, onDone, onCancel }: RealizationPanelProps) {
  const [type, setType] = useState("music-video");
  const [rightsHolderRef, setRightsHolderRef] = useState("");
  const [rightsBasis, setRightsBasis] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMessage(null);
    const created = await api("/api/authority/media-realization", {
      master_id: masterId,
      realization_type: type,
      rights_holder_ref: rightsHolderRef || null,
      rights_basis: rightsBasis || null,
      production_notes: notes || null,
    });
    if (created.error) {
      setBusy(false);
      setMessage(`${workTitle} — Production version: ${created.error} Next: select a registered participant.`);
      return;
    }
    const bound = await fetch("/api/authority/media-realization/bind", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ binding_id: bindingId, master_id: masterId, realization_id: created.realization_id }),
    }).then(responseData);
    setBusy(false);
    if (bound.error) {
      setMessage(`${workTitle} — Production version: ${bound.error} Next: verify the selected production details.`);
      return;
    }
    onDone();
  }

  return (
    <StudioFormPanel
      title="Record realization"
      description="Production context attached to this media binding."
      onCancel={!busy ? onCancel : undefined}
    >
      <div className="grid gap-3">
        <StudioField label="Type">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            disabled={busy}
            className={studioSelectClass}
          >
            {REALIZATION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </StudioField>
        <StudioField label="Rights owner">
          <select
            value={rightsHolderRef}
            onChange={(e) => setRightsHolderRef(e.target.value)}
            disabled={busy}
            className={studioSelectClass}
          >
            <option value="">Select rights owner</option>
            {participants.map((p) => (
              <option key={p.participant_id} value={p.participant_id}>{p.label}</option>
            ))}
          </select>
        </StudioField>
        <StudioField label="Rights basis">
          <input
            type="text"
            placeholder="Realization rights basis"
            value={rightsBasis}
            onChange={(e) => setRightsBasis(e.target.value)}
            disabled={busy}
            className={studioInputClass}
          />
        </StudioField>
        <StudioField label="Production notes" hint="Optional — provenance context">
          <textarea
            placeholder="Production context / provenance notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={busy}
            rows={3}
            className={studioTextareaClass}
          />
        </StudioField>
        <StudioFeedback message={message} />
        <Button
          size="sm"
          disabled={busy || !rightsHolderRef || !rightsBasis}
          onClick={() => void submit()}
        >
          Record and associate realization
        </Button>
      </div>
    </StudioFormPanel>
  );
}

// ─── CreateExperiencePanel ────────────────────────────────────────────────────

type CreateExperiencePanelProps = {
  stateId: string;
  masterId: string;
  busy: boolean;
  onCreate: (stateId: string, masterId: string, type: string) => void;
};

export function CreateExperiencePanel({ stateId, masterId, busy, onCreate }: CreateExperiencePanelProps) {
  const [expType, setExpType] = useState("experiential");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={expType}
        onChange={(e) => setExpType(e.target.value)}
        className={studioSelectClass}
        style={{ maxWidth: "16rem" }}
      >
        {PROJECTION_TYPES.map((t) => (
          <option key={t} value={t}>{EXPERIENCE_TYPE_LABELS[t]}</option>
        ))}
      </select>
      <Button size="sm" disabled={busy} onClick={() => onCreate(stateId, masterId, expType)}>
        Create Experience
      </Button>
    </div>
  );
}

// ─── TimelineEditor ───────────────────────────────────────────────────────────

type TimelineBinding = {
  binding_id: string;
  projection_id: string;
  start_ms: number | null;
  end_ms: number | null;
  media_asset: { storage_ref: string; provider?: string | null } | null;
};

type TimelineEditorProps = {
  binding: TimelineBinding;
  masterId: string;
  onDone: () => void;
  onCancel: () => void;
};

export function TimelineEditor({ binding, masterId, onDone, onCancel }: TimelineEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [startMs, setStartMs] = useState(binding.start_ms ?? 0);
  const [endMs, setEndMs] = useState(binding.end_ms ?? 0);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(
    binding.media_asset?.provider && binding.media_asset.provider !== "mux"
      ? "Error: This media asset has no supported provider."
      : null,
  );
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

    function loadHls(hlsUrl: string) {
      if (!video) return;
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = hlsUrl;
      } else {
        import("hls.js").then(({ default: Hls }) => {
          if (!Hls.isSupported()) { setMessage("Error: HLS not supported in this browser."); return; }
          const hlsPlayer = new Hls();
          hlsRef.current = hlsPlayer;
          hlsPlayer.loadSource(hlsUrl);
          hlsPlayer.attachMedia(video!);
        });
      }
    }

    if (binding.media_asset?.provider === "mux") {
      loadHls(`https://stream.mux.com/${playbackId}.m3u8`);
    }

    return () => {
      video.pause();
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [binding.media_asset?.storage_ref, binding.media_asset?.provider]);

  async function saveRange() {
    if (!Number.isInteger(startMs) || !Number.isInteger(endMs) || endMs <= startMs) {
      setMessage("Error: End must be greater than start.");
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/authority/media/timeline", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ binding_id: binding.binding_id, master_id: masterId, start_ms: startMs, end_ms: endMs }),
    });
    const result = await responseData(res);
    setBusy(false);
    if (!res.ok || result.error) { setMessage(`Error: ${result.error ?? "Save failed"}`); return; }
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
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/authority/media/artwork", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ master_id: masterId, projection_id: binding.projection_id, thumbnail_url: thumbnailUrl }),
    });
    const result = await responseData(res);
    setBusy(false);
    if (!res.ok || result.error) { setMessage(`Error: ${result.error ?? "Unable to select thumbnail"}`); return; }
    setMessage("Thumbnail selected as representative artwork.");
  }

  return (
    <StudioFormPanel
      title="Timeline"
      description="Play the video, then set start and end points."
      onCancel={!busy ? onCancel : undefined}
    >
      <div className="grid gap-3">
        <video ref={videoRef} controls className="w-full aspect-video bg-black rounded" />
        {thumbnailUrl ? (
          <div className="grid gap-2">
            <p className="suite-kicker">Thumbnail preview</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbnailUrl} alt="Generated video thumbnail" className="w-32 aspect-video object-cover border border-border rounded" />
            <Button size="sm" variant="outline" onClick={() => void selectThumbnail()} disabled={busy}>
              Use as artwork
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">Current {formatTimelineMs(currentMs)}</Badge>
          <Badge variant="outline">Duration {formatTimelineMs(durationMs)}</Badge>
          <Badge variant="secondary">{formatTimelineMs(startMs)} → {formatTimelineMs(endMs)}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" onClick={() => setStartMs(currentMs)}>Set Start</Button>
          <Button size="sm" variant="outline" onClick={() => setEndMs(currentMs)}>Set End</Button>
          <SecondsField label="Start" valueMs={startMs} onChange={setStartMs} />
          <SecondsField label="End" valueMs={endMs} onChange={setEndMs} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={previewRange} disabled={endMs <= startMs}>Preview range</Button>
          <Button size="sm" variant="outline" onClick={() => { setStartMs(0); setEndMs(durationMs); setPreviewing(false); }}>Reset</Button>
          <Button size="sm" onClick={() => void saveRange()} disabled={busy || endMs <= startMs}>Save exact range</Button>
        </div>
        <StudioFeedback message={message} />
      </div>
    </StudioFormPanel>
  );
}

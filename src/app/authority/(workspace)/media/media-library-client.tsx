"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ChevronRight, Music, Video, Film, Image as ImageIcon, FileQuestion, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/media/timing";
import type { MediaLibraryItem } from "./page";

type UnlinkedIntake = { intake_id: string; title: string; work_type: string; creator_name: string | null; created_at: string };

type Props = {
  items: MediaLibraryItem[];
  unlinkedIntakes: UnlinkedIntake[];
};

const TYPE_FILTERS = [
  { value: "all", label: "All" },
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
  { value: "animation", label: "Animation" },
  { value: "other", label: "Other" },
] as const;

const READINESS_FILTERS = [
  { value: "all", label: "All status" },
  { value: "ready", label: "Ready" },
  { value: "playable", label: "Playable" },
  { value: "processing", label: "Processing" },
  { value: "intake", label: "Intake" },
] as const;

function mediaTypeIcon(workType: string | null, assetType: string) {
  if (workType === "song" || workType === "audio") return <Music size={16} className="text-muted-foreground/60" />;
  if (workType === "animation") return <Film size={16} className="text-muted-foreground/60" />;
  if (workType === "video") return <Video size={16} className="text-muted-foreground/60" />;
  if (assetType === "thumbnail") return <ImageIcon size={16} className="text-muted-foreground/60" />;
  return <FileQuestion size={16} className="text-muted-foreground/60" />;
}

function readinessBadgeClass(overall: string) {
  if (overall === "ready") return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
  if (overall === "playable") return "text-violet-400 border-violet-500/30 bg-violet-500/10";
  if (overall === "processing") return "text-amber-400 border-amber-500/30 bg-amber-500/10";
  return "text-muted-foreground border-border bg-card/40";
}

function readinessLabel(overall: string) {
  if (overall === "ready") return "Ready";
  if (overall === "playable") return "Playable";
  if (overall === "processing") return "Processing";
  return "Intake";
}

function CanonicalContext({ item }: { item: MediaLibraryItem }) {
  if (item.universe_title || item.mural_title || item.scene_title) {
    return (
      <div className="text-[10px] text-muted-foreground/60 leading-tight">
        {item.universe_title && <span>{item.universe_title}</span>}
        {item.mural_title && <><span className="mx-1 opacity-40">›</span><span>{item.mural_title}</span></>}
        {item.scene_title && <><span className="mx-1 opacity-40">›</span><span>{item.scene_title}</span></>}
      </div>
    );
  }
  return <span className="text-[10px] text-muted-foreground/40 italic">Unassigned</span>;
}

function MediaCard({ item }: { item: MediaLibraryItem }) {
  const [thumbError, setThumbError] = useState(false);
  const isAudio = item.work_type === "song" || item.work_type === "audio";
  const showThumb = item.thumbnail_url && !thumbError && !isAudio;

  return (
    <Link
      href={`/authority/media/${item.asset_id}`}
      className="group flex flex-col rounded-lg border border-border bg-card/50 overflow-hidden hover:border-border/80 hover:bg-card/80 transition-colors"
    >
      {/* Thumbnail / media representation */}
      <div className="relative aspect-video bg-muted/30 flex items-center justify-center overflow-hidden">
        {showThumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail_url!}
            alt={item.title ?? "Media thumbnail"}
            className="w-full h-full object-cover"
            onError={() => setThumbError(true)}
          />
        ) : isAudio ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground/40">
            <Music size={28} />
            <span className="text-[10px] uppercase tracking-widest">Audio</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground/30">
            {mediaTypeIcon(item.work_type, item.asset_type)}
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/30">
              {item.work_type ?? item.asset_type}
            </span>
          </div>
        )}
        {/* Readiness badge overlay */}
        <div className="absolute top-2 right-2">
          <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${readinessBadgeClass(item.readiness_overall)}`}>
            {readinessLabel(item.readiness_overall)}
          </span>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex flex-col gap-1.5 px-3 py-3 flex-1">
        <p className="text-sm font-medium text-foreground leading-tight line-clamp-1">
          {item.title ?? <span className="font-mono text-xs text-muted-foreground">{item.storage_ref.slice(0, 14)}…</span>}
        </p>

        <CanonicalContext item={item} />

        <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1.5">
          {item.work_type && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              {item.work_type}
            </Badge>
          )}
          {item.duration_ms && (
            <span className="text-[10px] text-muted-foreground/60">
              {formatDuration(item.duration_ms / 1000)}
            </span>
          )}
          {item.rights_holder_ref ? (
            <span className="text-[10px] text-emerald-400/80">Rights ✓</span>
          ) : (
            <span className="text-[10px] text-amber-400/80">Rights?</span>
          )}
          {item.isrc && (
            <span className="text-[10px] text-muted-foreground/60 font-mono">ISRC</span>
          )}
        </div>

        {item.readiness_blockers.length > 0 && (
          <p className="text-[10px] text-muted-foreground/50 leading-tight">
            {item.readiness_blockers[0]}{item.readiness_blockers.length > 1 ? ` +${item.readiness_blockers.length - 1}` : ""}
          </p>
        )}
      </div>
    </Link>
  );
}

// ─── Intake upload panel ─────────────────────────────────────────────────────

function IntakeUploadPanel({ intake, onDone, onCancel }: { intake: UnlinkedIntake; onDone: () => void; onCancel: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const ACCEPTED = "video/mp4,video/*,audio/mpeg,audio/mp3,audio/wav,audio/flac,audio/x-flac,audio/aiff,audio/x-aiff,audio/m4a,audio/x-m4a,audio/ogg,audio/opus,audio/*";

  function isAccepted(f: File) {
    return f.type.startsWith("video/") || f.type.startsWith("audio/") ||
      /\.(mp4|mov|avi|mkv|webm|mp3|wav|flac|aiff|aif|m4a|aac|ogg|opus)$/i.test(f.name);
  }

  async function startUpload() {
    if (!file) return;
    setBusy(true); setMsg(null); setProgress(null); setPhase(null);
    try {
      if (!isAccepted(file)) throw new Error("Select a video or audio file.");

      // Create upload session — intake-only (no projection_id/master_id required)
      const sessionRes = await fetch("/api/authority/media/upload-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, intake_id: intake.intake_id }),
      });
      const session = await sessionRes.json();
      if (!sessionRes.ok || session.error || !session.upload_url || !session.session_id) {
        throw new Error(session.error ?? "Upload session could not be created.");
      }

      // Upload file directly to Mux
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100));
        };
        xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: HTTP ${xhr.status}`));
        xhr.onerror = () => reject(new Error("Network error during upload."));
        xhr.open("PUT", session.upload_url);
        xhr.send(file);
      });

      setProgress(100);
      setMsg("Uploaded. Waiting for media processing…");

      // Poll until ingested or failed
      let currentPhase = "uploading";
      for (let attempt = 0; currentPhase !== "ingested" && currentPhase !== "ready" && attempt < 60; attempt++) {
        await new Promise((r) => setTimeout(r, 5000));
        const pollRes = await fetch(`/api/authority/media/upload-session/${session.session_id}`);
        const pollData = await pollRes.json();
        if (!pollRes.ok || pollData.error) throw new Error(pollData.error ?? "Polling failed.");
        currentPhase = pollData.phase ?? "unknown";
        setPhase(currentPhase);
        if (currentPhase === "failed") throw new Error("Media processing failed.");
        setMsg(`Processing… (${currentPhase})`);
      }

      if (currentPhase !== "ingested" && currentPhase !== "ready") {
        throw new Error("Processing timed out. The media may still be processing — check the Media Library shortly.");
      }

      setMsg("Media processed and ready in the Media Library.");
      setTimeout(onDone, 1500);
    } catch (err) {
      setMsg(`Error: ${err instanceof Error ? err.message : "Upload failed."}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card/60 px-4 py-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{intake.title}</p>
          <p className="text-xs text-muted-foreground">{intake.work_type} · {new Date(intake.created_at).toLocaleDateString()}</p>
        </div>
        {!busy && (
          <button type="button" onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground shrink-0">Cancel</button>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept={ACCEPTED} disabled={busy} className="sr-only"
        onChange={(e) => { setFile(e.target.files?.[0] ?? null); setMsg(null); }} />

      <button
        type="button"
        disabled={busy}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full rounded-lg border-2 border-dashed px-4 py-4 text-center transition-colors
          ${file ? "border-border bg-muted/20" : "border-border hover:border-foreground/30 hover:bg-muted/10 cursor-pointer"}
          disabled:pointer-events-none disabled:opacity-50`}
      >
        {file ? (
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Click to choose a file</p>
            <p className="text-xs text-muted-foreground/60">MP4, MOV, MP3, WAV, FLAC, M4A and more</p>
          </div>
        )}
      </button>

      {busy && progress !== null && (
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "var(--accent-mv)" }} />
          </div>
          <p className="text-xs text-muted-foreground">{progress < 100 ? `${progress}%` : phase ?? "Processing…"}</p>
        </div>
      )}

      {msg && (
        <p className={`text-sm ${msg.startsWith("Error") ? "text-destructive" : "text-foreground"}`}>{msg}</p>
      )}

      <Button size="sm" disabled={busy || !file} onClick={startUpload}>
        <Upload size={13} /> Upload media
      </Button>
    </div>
  );
}

// ─── Awaiting upload section ──────────────────────────────────────────────────

function AwaitingUploadSection({ intakes }: { intakes: UnlinkedIntake[] }) {
  const [activeIntakeId, setActiveIntakeId] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  const visible = intakes.filter((i) => !done.has(i.intake_id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Intake Records — Awaiting Upload
        </p>
        <span className="text-[10px] text-muted-foreground/60">{visible.length}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        These intake records exist but have not yet been linked to a media asset.
        Select an intake to upload the file directly.
      </p>

      <div className="space-y-2">
        {visible.map((intake) =>
          activeIntakeId === intake.intake_id ? (
            <IntakeUploadPanel
              key={intake.intake_id}
              intake={intake}
              onDone={() => {
                setDone((prev) => new Set([...prev, intake.intake_id]));
                setActiveIntakeId(null);
              }}
              onCancel={() => setActiveIntakeId(null)}
            />
          ) : (
            <div
              key={intake.intake_id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/50 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{intake.title}</p>
                <p className="text-xs text-muted-foreground">
                  {intake.work_type} · {new Date(intake.created_at).toLocaleDateString()}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveIntakeId(intake.intake_id)}
              >
                <Upload size={13} /> Upload media
              </Button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function MediaLibraryClient({ items, unlinkedIntakes }: Props) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [readinessFilter, setReadinessFilter] = useState<string>("all");

  const filtered = items.filter((item) => {
    const typeMatch =
      typeFilter === "all" ||
      item.work_type === typeFilter ||
      (typeFilter === "other" && !["song", "audio", "video", "animation"].includes(item.work_type ?? ""));
    const readinessMatch = readinessFilter === "all" || item.readiness_overall === readinessFilter;
    return typeMatch && readinessMatch;
  });

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card/50 p-1">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setTypeFilter(f.value)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === f.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card/50 p-1">
          {READINESS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setReadinessFilter(f.value)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                readinessFilter === f.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {(typeFilter !== "all" || readinessFilter !== "all") && (
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {items.length}
          </span>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card/30 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {items.length === 0
              ? "No media assets yet."
              : "No assets match this filter."}
          </p>
          {items.length === 0 && (
            <Link href="/authority/media/intake" className="mt-3 inline-block text-xs text-muted-foreground underline hover:text-foreground">
              Add media →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => (
            <MediaCard key={item.asset_id} item={item} />
          ))}
        </div>
      )}

      {/* Unlinked intake records */}
      {unlinkedIntakes.length > 0 && (
        <AwaitingUploadSection intakes={unlinkedIntakes} />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Music, Video, Film, Image as ImageIcon, FileQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Intake Records — Awaiting Upload
            </p>
            <span className="text-[10px] text-muted-foreground/60">
              {unlinkedIntakes.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            These intake records exist but have not yet been linked to a media asset. Open the relevant work to upload.
          </p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/20">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Title</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Type</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {unlinkedIntakes.map((i) => (
                  <tr key={i.intake_id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{i.title}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground text-xs">{i.work_type}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                      {new Date(i.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

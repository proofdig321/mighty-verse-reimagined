"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import ArtworkFrame from "@/components/artwork-frame";
import MediaVisual from "@/components/media-visual";

type MomentItem = {
  projection_id: string;
  title: string | null;
  projection_type: string;
  collectible_designated: boolean;
  has_media: boolean;
  playback_id: string | null;
  canonical_type: string | null;
};

type Props = { moments: MomentItem[] };

const TABS = ["All", "Collectible", "Moment Cards", "Highlights"] as const;
type Tab = (typeof TABS)[number];

const PROJ_LABELS: Record<string, string> = {
  "experiential": "Experiential",
  "distributional": "Distributional",
  "archival": "Archival",
  "other": "Moment",
};

export default function MomentsFilterClient({ moments }: Props) {
  const [tab, setTab] = useState<Tab>("All");
  const [query, setQuery] = useState("");

  const filtered = moments.filter((m) => {
    if (tab === "Collectible" && !m.collectible_designated) return false;
    if (tab === "Moment Cards" && m.projection_type !== "distributional") return false;
    if (tab === "Highlights" && m.projection_type !== "experiential") return false;
    if (query.trim() && !(m.title ?? "").toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <Input
          placeholder="Search moments..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <select className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-muted-foreground" defaultValue="">
          <option value="">All Types</option>
        </select>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === t ? "text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")}
            style={tab === t ? { borderBottomColor: "var(--accent-mv)" } : undefined}
          >
            {t}
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="artifact-grid">
          {filtered.map((m) => (
            <Link key={m.projection_id} href={`/moments/${m.projection_id}`} className="artifact-card group">
              <div className="relative">
                {m.playback_id ? <MediaVisual playbackId={m.playback_id} title={m.title ?? "Creative Moment"} aspectRatio="1/1" /> : <ArtworkFrame artworkUrl={null} alt={m.title ?? ""} aspectRatio="2/3" />}
                {m.has_media && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-black/60">
                      <span className="text-white text-xs ml-0.5">▶</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="artifact-copy">
                <p className="text-sm font-medium text-foreground truncate group-hover:opacity-70 transition-opacity">
                  {m.title ?? "Untitled"}
                </p>
                <div className="flex items-center gap-1">
                  {m.canonical_type && (
                    <span className="text-xs text-muted-foreground capitalize">
                      {m.canonical_type === "scene" ? "Scene" : m.canonical_type === "creative-moment" ? "Moment" : m.canonical_type}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {PROJ_LABELS[m.projection_type] ?? m.projection_type}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No moments yet.</p>
      )}
    </div>
  );
}

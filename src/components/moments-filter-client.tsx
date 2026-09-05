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
  context_title: string | null;
  context_type: string | null;
  context_href: string | null;
};

type Props = { moments: MomentItem[] };

const TABS = ["All", "Collectible", "Moment Cards", "Highlights"] as const;
type Tab = (typeof TABS)[number];

const PROJ_LABELS: Record<string, string> = {
  experiential: "Experiential",
  distributional: "Distributional",
  archival: "Archival",
  other: "Moment",
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
    <div>
      {/* Header band */}
      <div className="border-b border-border bg-card/20">
        <div className="mx-auto max-w-7xl px-6 py-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-mv">
              Creative artifacts
            </p>
            <h1
              className="mt-1.5 text-3xl font-semibold text-foreground md:text-4xl"
              style={{ fontFamily: "var(--font-display, inherit)" }}
            >
              All Moments
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Discover and collect creative moments from across all universes.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Input
              placeholder="Search moments…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-44 h-9 text-sm"
            />
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-muted-foreground"
              defaultValue=""
            >
              <option value="">All Types</option>
            </select>
          </div>
        </div>

        {/* Filter tabs — inside the header band, below the row */}
        <div className="mx-auto max-w-7xl px-6 flex items-center gap-0.5 overflow-x-auto scrollbar-hidden">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "shrink-0 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                tab === t
                  ? "text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              ].join(" ")}
              style={tab === t ? { borderBottomColor: "var(--accent-mv)" } : undefined}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-6 py-10">
        {filtered.length > 0 ? (
          <div className="artifact-grid">
            {filtered.map((m) => (
              <Link key={m.projection_id} href={`/moments/${m.projection_id}`} className="artifact-card group">
                <div className="relative">
                  {m.playback_id ? (
                    <MediaVisual playbackId={m.playback_id} title={m.title ?? "Creative Moment"} aspectRatio="1/1" />
                  ) : (
                    <ArtworkFrame artworkUrl={null} alt={m.title ?? ""} aspectRatio="2/3" />
                  )}
                  {m.has_media && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-black/60">
                        <span className="text-white text-xs ml-0.5">▶</span>
                      </div>
                    </div>
                  )}
                  {m.collectible_designated && (
                    <div className="absolute top-2 left-2">
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                        style={{ background: "var(--accent-mv-gold)", color: "#000" }}
                      >
                        Rare
                      </span>
                    </div>
                  )}
                </div>
                <div className="artifact-copy">
                  <p className="text-sm font-medium text-foreground truncate group-hover:opacity-70 transition-opacity">
                    {m.title ?? "Untitled"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.canonical_type === "scene" ? "Scene" : m.canonical_type === "creative-moment" ? "Moment" : (PROJ_LABELS[m.projection_type] ?? m.projection_type)}
                  </p>
                  {m.context_title && m.context_href && (
                    <p className="text-xs truncate" style={{ color: "var(--accent-mv)" }}>
                      {m.context_title}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card/40 px-8 py-12 text-center">
            <p className="text-sm text-muted-foreground">No moments yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

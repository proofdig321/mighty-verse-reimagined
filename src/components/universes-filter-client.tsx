"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import ArtworkFrame from "@/components/artwork-frame";
import MediaVisual from "@/components/media-visual";

type UniverseItem = {
  master_id: string;
  title: string | null;
  attribution_roles: string[];
  projection_count: number;
  playback_id: string | null;
};

type Props = { universes: UniverseItem[] };

export default function UniversesFilterClient({ universes }: Props) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? universes.filter((u) =>
        (u.title ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : universes;

  return (
    <div>
      {/* Header band — heading + description left, controls right */}
      <div className="border-b border-border bg-card/20">
        <div className="mx-auto max-w-7xl px-6 py-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-mv">
              Discover the canon
            </p>
            <h1
              className="mt-1.5 text-3xl font-semibold text-foreground md:text-4xl"
              style={{ fontFamily: "var(--font-display, inherit)" }}
            >
              All Universes
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Explore all song universes. Each one holds its own stories, murals and moments.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Input
              placeholder="Search universes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-48 h-9 text-sm"
            />
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-muted-foreground"
              defaultValue=""
            >
              <option value="">All Genres</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-6 py-10 space-y-4">
        {filtered.length > 0 ? (
          <div className="artifact-grid-wide">
            {filtered.map((u) => (
              <Link key={u.master_id} href={`/worlds/${u.master_id}`} className="artifact-card group">
                {u.playback_id ? (
                  <MediaVisual playbackId={u.playback_id} title={u.title ?? "Universe"} aspectRatio="16/9" />
                ) : (
                  <ArtworkFrame artworkUrl={null} alt={u.title ?? ""} aspectRatio="16/9" />
                )}
                <div className="artifact-copy">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className="text-base font-semibold text-foreground truncate group-hover:opacity-80 transition-opacity"
                      style={{ fontFamily: "var(--font-display, inherit)" }}
                    >
                      {u.title ?? "Untitled"}
                    </p>
                    <span
                      className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border"
                      style={{
                        color: "var(--accent-mv)",
                        borderColor: "color-mix(in oklch, var(--accent-mv) 40%, transparent)",
                      }}
                    >
                      Universe
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    {u.attribution_roles.length > 0
                      ? u.attribution_roles.map((r) => r.replace(/-/g, " ")).join(", ")
                      : "Various Artists"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {u.projection_count} Moment{u.projection_count !== 1 ? "s" : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card/40 px-8 py-12 text-center">
            <p className="text-sm text-muted-foreground">No universes found.</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground pt-2">
          {filtered.length} universe{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}

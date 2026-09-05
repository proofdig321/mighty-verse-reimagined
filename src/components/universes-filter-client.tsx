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
    <div className="space-y-8">
      <div className="flex gap-3">
        <Input
          placeholder="Search universes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
        <select
          className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm text-muted-foreground"
          defaultValue=""
        >
          <option value="">All Genres</option>
        </select>
      </div>

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
    </div>
  );
}

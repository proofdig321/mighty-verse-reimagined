"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import ArtworkFrame from "@/components/artwork-frame";
import MediaVisual from "@/components/media-visual";
import { PublicHero } from "@/components/public-hero";

type UniverseItem = {
  master_id: string;
  title: string | null;
  attribution_roles: string[];
  playback_id: string | null;
  provider: string | null;
};

type Props = { universes: UniverseItem[] };

export default function UniversesFilterClient({ universes }: Props) {
  const [query, setQuery] = useState("");
  const searchParams = useSearchParams();
  const experienceJourney = searchParams.get("intent") === "experience";

  const filtered = query.trim()
    ? universes.filter((u) =>
        (u.title ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : universes;

  return (
    <div data-experience-journey={experienceJourney ? "true" : "false"}>
      <PublicHero
        eyebrow={experienceJourney ? "Experience" : "Discover the canon"}
        title={experienceJourney ? "Enter Experience" : "All Universes"}
        description={
          experienceJourney
            ? "Open a Universe, then enter its public Experience. This is not Studio preview."
            : "Explore a Universe to reveal its Mural, Scenes, and Creative Moments, then enter Experience."
        }
        aside={
          <>
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
          </>
        }
      />

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-6 py-10 space-y-4">
        {filtered.length > 0 ? (
          <div className="artifact-grid-wide">
            {filtered.map((u) => (
              <Link
                key={u.master_id}
                href={`/worlds/${u.master_id}`}
                className="artifact-card group"
                data-universe-card={u.master_id}
              >
                {u.playback_id ? (
                  <MediaVisual playbackId={u.playback_id} provider={u.provider} title={u.title ?? "Universe"} aspectRatio="16/9" />
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
                    {experienceJourney ? "Open Universe, then Enter Experience" : "Explore, then enter Experience"}
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

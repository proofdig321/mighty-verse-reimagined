"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
        (u.title ?? "").toLowerCase().includes(query.toLowerCase()) ||
        u.attribution_roles.some((r) => r.toLowerCase().includes(query.toLowerCase()))
      )
    : universes;

  return (
    <div data-experience-journey={experienceJourney ? "true" : "false"}>
      <PublicHero
        eyebrow={experienceJourney ? "2.5D" : "Discover the canon"}
        title={experienceJourney ? "Enter 2.5D" : "All Universes"}
        description={
          experienceJourney
            ? "Open a Universe to enter 2.5D. Holographic Experience is a separate cinema destination."
            : "Explore a Universe to reveal its Mural, Scenes, and Creative Moments, then enter 2.5D or Holographic Experience."
        }
        aside={
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search universes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-52 pl-8 h-9 text-sm"
              aria-label="Search universes"
            />
          </div>
        }
      />

      <div className="mx-auto max-w-7xl px-6 py-10 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {filtered.length} universe{filtered.length !== 1 ? "s" : ""}
            {query.trim() ? ` matching "${query}"` : ""}
          </p>
          {query.trim() && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
        </div>

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
                    <Badge variant="outline" className="shrink-0 text-[10px]" style={{ color: "var(--accent-mv)", borderColor: "color-mix(in oklch, var(--accent-mv) 40%, transparent)" }}>
                      Universe
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    {u.attribution_roles.length > 0
                      ? u.attribution_roles.map((r) => r.replace(/-/g, " ")).join(", ")
                      : "Various Artists"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {experienceJourney ? "Open Universe → Enter 2.5D" : "Explore → 2.5D or Holographic"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card/40 px-8 py-16 text-center">
            <Globe size={24} className="mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">
              {query.trim() ? `No universes matching "${query}"` : "No universes yet"}
            </p>
            {query.trim() && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Clear search
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

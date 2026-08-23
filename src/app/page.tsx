export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import type { DiscoveryUniverse } from "@/lib/discovery";
import { getDiscovery } from "@/lib/discovery";
import MomentCard from "@/components/moment-card";
import ArtworkFrame from "@/components/artwork-frame";
import MediaVisual from "@/components/media-visual";

export const metadata: Metadata = {
  title: "Mighty Verse",
  description: "Enter the creative universe.",
};

const TYPE_LABELS: Record<string, string> = {
  "universe": "Universe",
  "creative-moment": "Creative Moment",
  "mural": "Mural",
  "interpretation": "Interpretation",
  "other": "Work",
};

const PROJ_LABELS: Record<string, string> = {
  "experiential": "Experiential",
  "distributional": "Distributional",
  "archival": "Archival",
  "other": "Moment",
};

export default async function HomePage() {
  const universes = await getDiscovery();

  // Only surface universes with authored presentation identity
  const authored = universes.filter((w: DiscoveryUniverse) => !!w.title);
  const featured = authored[0] ?? null;
  const remaining = authored.slice(1);

  if (!featured) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 pt-16">
          <p className="text-muted-foreground text-sm">No universes yet.</p>
        </div>
      </main>
    );
  }

  const featuredTypeLabel = TYPE_LABELS[featured.canonical_type] ?? featured.canonical_type.replace(/-/g, " ");

  return (
    <main className="min-h-screen bg-background multiverse-page">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="multiverse-stage border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-16 md:py-24">
          <div className="depth-panel flex flex-col md:flex-row md:items-start gap-10 md:gap-16">

            {/* Artwork slot — empty until genuine artwork exists */}
            <div className="w-full md:w-80 shrink-0">
              {featured.visual_playback_id ? (
                <MediaVisual playbackId={featured.visual_playback_id} title={featured.title ?? "Mighty Verse"} aspectRatio="16/9" />
              ) : (
                <ArtworkFrame artworkUrl={null} alt={featured.title ?? ""} aspectRatio="1/1" />
              )}
            </div>

            {/* Identity */}
            <div className="space-y-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{featuredTypeLabel}</p>
              <h1
                className="text-5xl md:text-7xl font-semibold leading-none tracking-tight text-foreground"
                style={{ fontFamily: "var(--font-display, inherit)" }}
              >
                {featured.title}
              </h1>
              {featured.description && (
                <p className="text-lg text-muted-foreground">{featured.description}</p>
              )}
              <div className="flex items-center gap-3">
                {featured.has_media && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full border"
                    style={{ color: "var(--accent-mv)", borderColor: "var(--accent-mv)" }}>
                    ▶ Media available
                  </span>
                )}
                {featured.projections.some((p) => p.collectible_designated) && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full border border-border text-muted-foreground">
                    Collectible
                  </span>
                )}
              </div>
              <Link
                href={`/worlds/${featured.master_id}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:opacity-70 transition-opacity"
                style={{ fontFamily: "var(--font-display, inherit)" }}
              >
                Enter Universe
                <span style={{ color: "var(--accent-mv)" }}>→</span>
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ── MOMENTS ──────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-16">

        {/* Universe projections are not surfaced on Home — enter via Universe page */}

        {/* Additional authored universes */}
        {remaining.map((w: DiscoveryUniverse, index) => {
          const typeLabel = TYPE_LABELS[w.canonical_type] ?? w.canonical_type.replace(/-/g, " ");
          return (
            <section key={w.master_id} className={`spatial-world space-y-4 ${index % 2 ? "spatial-world-offset" : ""}`}>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{typeLabel}</p>
                <Link href={`/worlds/${w.master_id}`} className="group inline-flex items-center gap-2">
                  <h2
                    className="text-2xl font-semibold text-foreground group-hover:opacity-70 transition-opacity"
                    style={{ fontFamily: "var(--font-display, inherit)" }}
                  >
                    {w.title}
                  </h2>
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors text-sm">→</span>
                </Link>
                {w.description && <p className="text-sm text-muted-foreground">{w.description}</p>}
              </div>
              {w.projections.length > 0 && (
                <div className="space-y-2">
                  {w.projections.map((p) => (
                    <MomentCard
                      key={p.projection_id}
                      projectionId={p.projection_id}
                      title={p.title}
                      typeLabel={PROJ_LABELS[p.projection_type] ?? p.projection_type.replace(/-/g, " ")}
                      hasMedia={p.has_media}
                      collectible={p.collectible_designated}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}

      </div>
    </main>
  );
}

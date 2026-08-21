export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { getDiscovery } from "@/lib/discovery";
import MomentCard from "@/components/moment-card";

export const metadata: Metadata = {
  title: "Mighty Verse",
  description: "Enter the creative universe.",
};

const TYPE_LABELS: Record<string, string> = {
  "song-world": "Song World",
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
  const worlds = await getDiscovery();

  if (worlds.length === 0) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 pt-16">
          <p className="text-muted-foreground text-sm">No worlds yet.</p>
        </div>
      </main>
    );
  }

  const featured = worlds.find((w) => !!w.title) ?? null;
  const remaining = worlds.filter((w) => w !== featured);
  const namedRemaining = remaining.filter((w) => !!w.title);
  const unnamed = remaining.filter((w) => !w.title);

  return (
    <main className="min-h-screen bg-background">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      {featured && (() => {
        const typeLabel = TYPE_LABELS[featured.canonical_type] ?? featured.canonical_type.replace(/-/g, " ");
        return (
          <section className="border-b border-border">
            <div className="mx-auto max-w-5xl px-4 py-16 md:py-24">
              <div className="max-w-2xl space-y-6">

                {/* Eyebrow */}
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{typeLabel}</p>

                {/* Title */}
                <h1
                  className="text-5xl md:text-7xl font-semibold leading-none tracking-tight text-foreground"
                  style={{ fontFamily: "var(--font-display, inherit)" }}
                >
                  {featured.title}
                </h1>

                {/* Credit */}
                {featured.description && (
                  <p className="text-lg text-muted-foreground">{featured.description}</p>
                )}

                {/* Signals */}
                <div className="flex items-center gap-3 pt-2">
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

                {/* CTA */}
                <div className="pt-2">
                  <Link
                    href={`/worlds/${featured.master_id}`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:opacity-70 transition-opacity"
                    style={{ fontFamily: "var(--font-display, inherit)" }}
                  >
                    Enter World
                    <span style={{ color: "var(--accent-mv)" }}>→</span>
                  </Link>
                </div>

              </div>
            </div>
          </section>
        );
      })()}

      {/* ── WORLDS ───────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-16">

        {/* Featured world moments (below hero) */}
        {featured && featured.projections.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Moments — {featured.title}
              </h2>
              <Link
                href={`/worlds/${featured.master_id}`}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View World →
              </Link>
            </div>
            <div className="space-y-2">
              {featured.projections.map((p) => (
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
          </section>
        )}

        {/* Other named worlds */}
        {namedRemaining.map((w) => {
          const typeLabel = TYPE_LABELS[w.canonical_type] ?? w.canonical_type.replace(/-/g, " ");
          return (
            <section key={w.master_id} className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{typeLabel}</p>
                <Link
                  href={`/worlds/${w.master_id}`}
                  className="group inline-flex items-center gap-2"
                >
                  <h2
                    className="text-2xl font-semibold text-foreground group-hover:opacity-70 transition-opacity"
                    style={{ fontFamily: "var(--font-display, inherit)" }}
                  >
                    {w.title}
                  </h2>
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors text-sm">→</span>
                </Link>
                {w.description && (
                  <p className="text-sm text-muted-foreground">{w.description}</p>
                )}
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

        {/* Unnamed / unresolved works — receded */}
        {unnamed.length > 0 && (
          <section className="border-t border-border pt-8 space-y-1">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
              Works in progress
            </p>
            {unnamed.map((w) => {
              const typeLabel = TYPE_LABELS[w.canonical_type] ?? w.canonical_type.replace(/-/g, " ");
              return (
                <Link
                  key={w.master_id}
                  href={`/worlds/${w.master_id}`}
                  className="group flex items-center justify-between gap-4 py-2.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="text-sm">{typeLabel}</span>
                  <span className="text-xs font-mono opacity-40 group-hover:opacity-70 transition-opacity">
                    {w.master_id.slice(0, 8)}
                  </span>
                </Link>
              );
            })}
          </section>
        )}

      </div>
    </main>
  );
}

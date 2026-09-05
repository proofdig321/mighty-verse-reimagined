export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import type { DiscoveryUniverse } from "@/lib/discovery";
import { getDiscovery } from "@/lib/discovery";
import ArtworkFrame from "@/components/artwork-frame";
import MediaVisual from "@/components/media-visual";
import PageTopNav from "@/components/page-top-nav";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Mighty Verse",
  description: "Enter the creative universe.",
};

export default async function HomePage() {
  const universes = await getDiscovery();
  const featured = universes.filter(
    (w: DiscoveryUniverse) => !!w.title && w.canonical_type === "universe"
  );

  return (
    <div className="public-page">
      <PageTopNav activePath="/" />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="public-hero relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-24 md:py-36">
          <div className="max-w-3xl space-y-7">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-mv">
              A living catalogue of worlds
            </p>
            <h1
              className="text-5xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-7xl lg:text-8xl"
              style={{ fontFamily: "var(--font-display, inherit)" }}
            >
              Every Song is a Universe.{" "}
              <span style={{ color: "var(--accent-mv)" }}>Every Moment</span>{" "}
              is a Legend.
            </h1>
            <p className="max-w-lg text-lg text-muted-foreground leading-relaxed">
              Explore animated universes where music, art and story come to life.
              Collect the moments that matter.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/universes">
                <Button
                  className="h-11 px-6 text-sm font-semibold text-white"
                  style={{ background: "var(--accent-mv)" }}
                >
                  Explore Universes
                </Button>
              </Link>
              <Button variant="outline" className="h-11 px-6 text-sm" disabled>
                Watch Trailer
              </Button>
            </div>
          </div>

          {/* Floating stat strip */}
          <div className="mt-16 flex flex-wrap gap-8 border-t border-border/40 pt-8">
            {[
              { n: featured.length || "—", label: "Universes" },
              { n: "∞", label: "Creative Moments" },
              { n: "Base", label: "Network" },
            ].map(({ n, label }) => (
              <div key={label} className="flex items-baseline gap-2">
                <span
                  className="text-3xl font-semibold text-foreground"
                  style={{ fontFamily: "var(--font-display, inherit)" }}
                >
                  {n}
                </span>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Universes ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Featured
            </p>
            <h2
              className="mt-1 text-2xl font-semibold text-foreground"
              style={{ fontFamily: "var(--font-display, inherit)" }}
            >
              Universes
            </h2>
          </div>
          <Link
            href="/universes"
            className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            View all →
          </Link>
        </div>

        {featured.length > 0 ? (
          <div className="artifact-grid-wide">
            {featured.map((w: DiscoveryUniverse) => (
              <Link
                key={w.master_id}
                href={`/worlds/${w.master_id}`}
                className="artifact-card group"
              >
                {w.visual_playback_id ? (
                  <MediaVisual
                    playbackId={w.visual_playback_id}
                    title={w.title ?? "Universe"}
                    aspectRatio="16/9"
                  />
                ) : (
                  <ArtworkFrame
                    artworkUrl={null}
                    alt={w.title ?? ""}
                    aspectRatio="16/9"
                  />
                )}
                <div className="artifact-copy">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className="text-base font-semibold text-foreground truncate group-hover:opacity-80 transition-opacity"
                      style={{ fontFamily: "var(--font-display, inherit)" }}
                    >
                      {w.title}
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
                    {w.attribution_roles.length > 0
                      ? w.attribution_roles.map((r) => r.replace(/-/g, " ")).join(", ")
                      : "Various Artists"}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{w.projections.length} Moment{w.projections.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card/40 px-8 py-12 text-center">
            <p className="text-sm text-muted-foreground">No universes yet.</p>
          </div>
        )}
      </section>

      {/* ── Ontology strip ───────────────────────────────────────────────── */}
      <section className="border-t border-border/50">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            The experience
          </p>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
            {[
              { icon: "◎", label: "Universe", sub: "The canonical song world" },
              { icon: "▦", label: "Mural", sub: "The animated visual expression" },
              { icon: "◻", label: "Scene", sub: "A chapter within the Mural" },
              { icon: "◈", label: "Creative Moment", sub: "A collectible card" },
            ].map(({ icon, label, sub }) => (
              <div key={label} className="bg-card px-5 py-6">
                <span
                  className="text-xl"
                  style={{ color: "var(--accent-mv)" }}
                >
                  {icon}
                </span>
                <p className="mt-3 text-sm font-semibold text-foreground">{label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

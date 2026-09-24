export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import type { DiscoveryUniverse } from "@/lib/discovery";
import { getDiscovery } from "@/lib/discovery";
import { PublicHero } from "@/components/public-hero";
import { KineticCycler } from "@/components/kinetic-cycler";
import { ScrollReveal } from "@/components/scroll-reveal";
import { HeroTrailerWire } from "@/components/hero-trailer-wire";
import { UniverseCard } from "@/components/universe-card";
import { Button } from "@/components/ui/button";
import { muxStillFromPlayback } from "@/lib/media/thumbnail";

export const metadata: Metadata = {
  title: "Mighty Verse",
  description: "Enter the creative universe.",
};

export default async function HomePage() {
  const universes = await getDiscovery();
  const featured = universes.filter(
    (w: DiscoveryUniverse) => !!w.title && w.canonical_type === "universe"
  );

  const heroUniverse = featured.find((w) => w.visual_playback_id) ?? featured[0] ?? null;
  const heroVideoId = heroUniverse?.visual_playback_id ?? null;
  const heroStill = heroVideoId ? muxStillFromPlayback(heroVideoId, 4, 1920) : null;

  const cyclerLabels =
    featured.length > 0
      ? featured.map((w) => w.title ?? "Universe").slice(0, 8)
      : ["Universe", "Mural", "Legend", "Moment"];

  return (
    <div className="public-page">
      <HeroTrailerWire />

      <PublicHero
        size="display"
        eyebrow="A living catalogue of Universes"
        videoPlaybackId={heroVideoId}
        stillUrl={heroStill}
        universeTitle={heroUniverse?.title ?? "Mighty Verse"}
        title={
          <>
            Every Song is a{" "}
            <KineticCycler labels={cyclerLabels} />.{" "}
            <span style={{ color: "var(--accent-mv)" }}>Every Moment</span>{" "}
            is a Legend.
          </>
        }
        description="Discover a Universe, reveal its Mural, Scenes, and Creative Moments, then enter 2.5D or Holographic Experience."
        actions={
          <>
            <Link href="/universes">
              <Button
                className="h-11 px-6 text-sm font-semibold text-white"
                style={{ background: "var(--accent-mv)" }}
              >
                Explore Universes
              </Button>
            </Link>
            {heroVideoId ? (
              <Button
                variant="outline"
                className="h-11 px-6 text-sm"
                data-hero-trailer-proxy=""
              >
                Watch Trailer
              </Button>
            ) : null}
          </>
        }
        stats={[
          { n: featured.length || "—", label: "Universes" },
          { n: "Scenes", label: "in the Mural" },
          { n: "Creative Moments", label: "contributors" },
        ]}
      />

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
            {featured.map((w: DiscoveryUniverse, i) => (
              <ScrollReveal key={w.master_id} delay={i * 80}>
                <UniverseCard
                  masterId={w.master_id}
                  title={w.title}
                  visualPlaybackId={w.visual_playback_id}
                  visualProvider={w.visual_provider}
                  attributionRoles={w.attribution_roles}
                  projectionCount={w.projections.length}
                />
              </ScrollReveal>
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
            The creative structure
          </p>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
            {[
              { icon: "◎", label: "Universe", sub: "The canonical creative work" },
              { icon: "▦", label: "Mural", sub: "The complete audiovisual expression" },
              { icon: "◻", label: "Scene", sub: "A spatial unit in the Mural" },
              { icon: "◈", label: "Creative Moment", sub: "A contributor-centred unit" },
            ].map(({ icon, label, sub }) => (
              <ScrollReveal key={label}>
                <div className="bg-card px-5 py-6 h-full">
                  <span className="text-xl" style={{ color: "var(--accent-mv)" }}>{icon}</span>
                  <p className="mt-3 text-sm font-semibold text-foreground">{label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

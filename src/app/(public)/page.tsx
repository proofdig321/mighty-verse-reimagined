export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import type { DiscoveryUniverse } from "@/lib/discovery";
import { getDiscovery } from "@/lib/discovery";
import ArtworkFrame from "@/components/artwork-frame";
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
      <div className="flex-1">

        {/* Hero — full-width text, no artwork panel */}
        <section className="public-hero">
          <div className="relative z-10 mx-auto grid max-w-7xl gap-12 px-6 py-20 md:grid-cols-[1.2fr_0.8fr] md:items-end md:py-28">
            <div className="space-y-8">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent-mv">A living catalogue of worlds</p>
            <h1
              className="text-5xl md:text-7xl font-semibold leading-none tracking-tight text-foreground max-w-3xl"
              style={{ fontFamily: "var(--font-display, inherit)" }}
            >
              Every Song is a Universe. Every Moment is a Legend.
            </h1>
            <p className="text-lg text-muted-foreground max-w-md">
              Explore animated universes where music, art and story come to life.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/universes">
                <Button style={{ background: "var(--accent-mv)" }} className="text-white font-semibold">
                  Explore Universes
                </Button>
              </Link>
              <Button variant="outline" disabled>Watch Trailer</Button>
            </div>
            </div>
            <div className="hidden space-y-4 border-l border-border/70 pl-6 md:block">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">The experience</p>
              <p className="max-w-xs text-lg leading-relaxed text-foreground/80">Move from World to Mural to Scene and discover the Creative Moments inside.</p>
              <div className="flex gap-6 text-xs text-muted-foreground"><span><strong className="block text-2xl text-foreground">01</strong>Worlds</span><span><strong className="block text-2xl text-foreground">∞</strong>Moments</span></div>
            </div>
          </div>
        </section>

        {/* Featured Universes */}
        <section className="mx-auto max-w-7xl px-6 py-14">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Featured Universes
            </h2>
            <Link href="/universes" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              View all →
            </Link>
          </div>

          {featured.length > 0 ? (
            <div className="artifact-grid">
              {featured.map((w: DiscoveryUniverse) => (
                <Link
                  key={w.master_id}
                  href={`/worlds/${w.master_id}`}
                  className="artifact-card group"
                >
                  <ArtworkFrame artworkUrl={null} alt={w.title ?? ""} aspectRatio="2/3" />
                  <div className="artifact-copy">
                    <p
                      className="text-sm font-medium text-foreground truncate group-hover:opacity-70 transition-opacity"
                      style={{ fontFamily: "var(--font-display, inherit)" }}
                    >
                      {w.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {w.attribution_roles.length > 0
                        ? w.attribution_roles.map((r) => r.replace(/-/g, " ")).join(", ")
                        : "Various Artists"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {w.projections.length} Moment{w.projections.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No universes yet.</p>
          )}
        </section>

      </div>
    </div>
  );
}

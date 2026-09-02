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
  const authored = universes.filter((w: DiscoveryUniverse) => !!w.title);

  return (
    <main className="min-h-screen bg-background">
      <PageTopNav activePath="/" />

      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
          <div className="flex flex-col md:flex-row md:items-center gap-10 md:gap-16">

            <div className="flex-1 space-y-6">
              <h1
                className="text-5xl md:text-7xl font-semibold leading-none tracking-tight text-foreground"
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

            <div className="w-full md:w-80 shrink-0">
              <ArtworkFrame artworkUrl={null} alt="Mighty Verse" aspectRatio="16/9" />
            </div>

          </div>
        </div>
      </section>

      {/* Featured Universes */}
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Featured Universes
          </h2>
          <Link href="/universes" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            View all →
          </Link>
        </div>

        {authored.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
            {authored.map((w: DiscoveryUniverse) => (
              <Link
                key={w.master_id}
                href={`/worlds/${w.master_id}`}
                className="group shrink-0 w-40 space-y-2"
              >
                <ArtworkFrame artworkUrl={null} alt={w.title ?? ""} aspectRatio="2/3" />
                <div>
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
    </main>
  );
}

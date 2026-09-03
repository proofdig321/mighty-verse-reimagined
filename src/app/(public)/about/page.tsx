export const dynamic = "force-dynamic";

import Link from "next/link";
import { getDiscovery } from "@/lib/discovery";
import type { DiscoveryUniverse } from "@/lib/discovery";
import PageTopNav from "@/components/page-top-nav";
import { Button } from "@/components/ui/button";

export default async function AboutPage() {
  const universes = await getDiscovery();
  const universeCount = universes.filter((w: DiscoveryUniverse) => w.canonical_type === "universe").length;
  const momentCount = universes.reduce((acc: number, w: DiscoveryUniverse) => acc + w.projections.length, 0);

  const stats = [
    { label: "Universes", value: universeCount > 0 ? `${universeCount}+` : "—" },
    { label: "Moments", value: momentCount > 0 ? `${momentCount}+` : "—" },
    { label: "Creators", value: "50+" },
    { label: "Community", value: "Growing" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageTopNav activePath="/about" />

      {/* Page header */}
      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <h1 className="text-3xl font-semibold text-foreground" style={{ fontFamily: "var(--font-display, inherit)" }}>
            About Mighty Verse
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            A canonical cultural universe where every song is a world.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-10 space-y-12">

        {/* Mission */}
        <div className="max-w-3xl space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">What We Are</p>
          <p className="text-lg text-foreground leading-relaxed">
            Mighty Verse is a structured, navigable, attributable cultural universe. Songs become worlds. Murals bring those worlds to life. Creative Moments are the canonical units of meaning within each world — collectible, attributable, and permanent.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Mighty Verse Reimagined is a living ecosystem where music, art and story come together with provenance, rights and ownership built in from the ground up. A new way to experience, collect and participate in culture.
          </p>
        </div>

        {/* Stats */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">The Universe So Far</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {stats.map(({ label, value }) => (
              <div key={label} className="bg-card border border-border rounded-lg px-6 py-5">
                <p className="text-3xl font-semibold text-foreground" style={{ fontFamily: "var(--font-display, inherit)" }}>
                  {value}
                </p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pillars */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">How It Works</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: "🔭", label: "Discover", desc: "Explore song universes, murals and creative moments freely. No wallet required." },
              { icon: "⚡", label: "Collect", desc: "Own authorised projections of canonical creative moments as Cards, Editions and more." },
              { icon: "✦", label: "Participate", desc: "Contribute to the universe. Attribution and provenance are built into every work." },
              { icon: "⬡", label: "Authority", desc: "Canonical authority is held by Mighty Verse. Provenance is public and verifiable." },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="bg-card border border-border rounded-lg px-5 py-5 space-y-2">
                <span className="text-2xl">{icon}</span>
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-wrap gap-3 pb-4">
          <Link href="/universes">
            <Button style={{ background: "var(--accent-mv)" }} className="text-white font-semibold">
              Explore Universes
            </Button>
          </Link>
          <Link href="/auth/sign-in">
            <Button variant="outline">Join the Journey</Button>
          </Link>
        </div>

      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";

import Link from "next/link";
import { getDiscovery } from "@/lib/discovery";
import type { DiscoveryUniverse } from "@/lib/discovery";
import { Button } from "@/components/ui/button";
import { PublicHero } from "@/components/public-hero";

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
    <div className="public-page">

      <PublicHero
        eyebrow="The Mighty Verse model"
        title="About Mighty Verse"
        description="A canonical cultural universe where every song is a world."
      />

      <div className="mx-auto max-w-7xl space-y-14 px-6 py-12">

        {/* Mission */}
        <div className="max-w-3xl space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">What We Are</p>
          <p className="text-lg text-foreground leading-relaxed">
            Mighty Verse is a structured, navigable, attributable cultural Universe. Songs become Universes. Murals bring those Universes to life. Creative Moments are the canonical units of meaning within each Universe.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Mighty Verse Reimagined is a living ecosystem where music, art and story come together with provenance, rights and ownership built in from the ground up. A new way to experience, collect and participate in culture.
          </p>
        </div>

        {/* Stats */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">The Universe So Far</p>
          <div className="artifact-grid">
            {stats.map(({ label, value }) => (
              <div key={label} className="artifact-card artifact-copy">
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
          <div className="artifact-grid">
            {[
              { icon: "🔭", label: "Discover", desc: "Explore Universes, Murals, Scenes and Creative Moments freely. No wallet required." },
              { icon: "⚡", label: "Reveal", desc: "Understand the Mural, Scenes, and Creative Moments that make a Universe." },
              { icon: "✦", label: "Assemble", desc: "Compose the work in Creative Studio. Studio is not the public Experience." },
              { icon: "⬡", label: "2.5D & Holographic", desc: "Enter 2.5D on the Universe. Holographic Experience is the cinema. Presentation is not a second ontology." },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="artifact-card artifact-copy space-y-2">
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

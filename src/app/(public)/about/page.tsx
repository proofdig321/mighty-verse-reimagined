export const dynamic = "force-dynamic";

import Link from "next/link";
import { getDiscovery } from "@/lib/discovery";
import type { DiscoveryUniverse } from "@/lib/discovery";
import PageTopNav from "@/components/page-top-nav";
import ArtworkFrame from "@/components/artwork-frame";
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
    <main className="min-h-screen bg-background">
      <PageTopNav activePath="/about" />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid md:grid-cols-2 gap-12 items-start">

          <div className="space-y-8">
            <div className="space-y-4">
              <h1
                className="text-4xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display, inherit)" }}
              >
                About Mighty Verse
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Mighty Verse Reimagined is a living ecosystem where songs become universes, murals bring worlds to life, and moments become history you can collect, own and share. A new way to experience music, art and story.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {stats.map(({ label, value }) => (
                <div key={label} className="bg-card border border-border rounded-lg px-4 py-3">
                  <p
                    className="text-2xl font-semibold text-foreground"
                    style={{ fontFamily: "var(--font-display, inherit)" }}
                  >
                    {value}
                  </p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            <Link href="/auth/sign-in">
              <Button style={{ background: "var(--accent-mv)" }} className="text-white font-semibold">
                Join the Journey
              </Button>
            </Link>
          </div>

          <div>
            <ArtworkFrame artworkUrl={null} alt="Mighty Verse" aspectRatio="1/1" />
          </div>

        </div>
      </div>
    </main>
  );
}

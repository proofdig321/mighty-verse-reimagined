export const dynamic = "force-dynamic";

import { getDiscovery } from "@/lib/discovery";
import type { DiscoveryUniverse } from "@/lib/discovery";
import PageTopNav from "@/components/page-top-nav";
import UniversesFilterClient from "@/components/universes-filter-client";

export default async function UniversesPage() {
  const all = await getDiscovery();
  const universes = all
    .filter((w: DiscoveryUniverse) => w.canonical_type === "universe" && !!w.title)
    .map((w: DiscoveryUniverse) => ({
      master_id: w.master_id,
      title: w.title,
      attribution_roles: w.attribution_roles,
      projection_count: w.projections.length,
    }));

  return (
    <main className="min-h-screen bg-background">
      <PageTopNav activePath="/universes" />
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
        <div>
          <h1
            className="text-3xl font-semibold text-foreground"
            style={{ fontFamily: "var(--font-display, inherit)" }}
          >
            All Universes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Explore all song universes. Each one holds its own stories, murals and moments.
          </p>
        </div>
        <UniversesFilterClient universes={universes} />
      </div>
    </main>
  );
}

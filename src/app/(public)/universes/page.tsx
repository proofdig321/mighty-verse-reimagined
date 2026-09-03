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
    <div className="public-page">
      <PageTopNav activePath="/universes" />
      <div className="public-hero">
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent-mv">Discover the canon</p>
          <h1 className="mt-3 text-4xl font-semibold text-foreground md:text-5xl" style={{ fontFamily: "var(--font-display, inherit)" }}>
            All Universes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Explore all song universes. Each one holds its own stories, murals and moments.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-12">
        <UniversesFilterClient universes={universes} />
        <p className="text-xs text-muted-foreground">{universes.length} universe{universes.length !== 1 ? "s" : ""}</p>
      </div>
    </div>
  );
}

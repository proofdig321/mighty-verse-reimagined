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
      playback_id: w.visual_playback_id,
    }));

  return (
    <div className="public-page">
      <PageTopNav activePath="/universes" />
      <UniversesFilterClient universes={universes} />
    </div>
  );
}

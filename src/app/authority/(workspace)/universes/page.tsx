export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { curateHubHref } from "@/lib/assemble/studio";
import { loadUniverseCatalogue } from "@/lib/assemble/load-universe-catalogue";
import { UniverseCatalogueTable } from "@/components/assemble/universe-catalogue-table";
import { PaginationBar } from "@/components/ui/pagination-bar";

export default async function UniversesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/authority/universes");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in?next=/authority/universes");

  const { page } = await searchParams;
  const { rows: universes, pagination } = await loadUniverseCatalogue(page);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Creative Studio</p>
        <h1 className="text-3xl font-semibold tracking-tight">Universes</h1>
        <p className="text-sm text-muted-foreground">
          Curated work opens Creative Studio. In-progress work stays on Curate Hub. Edit identity or withdraw orphan shells here so they do not accumulate. Withdraw removes a work from Discover — records stay. Super Hero Ego cannot be withdrawn.
          {pagination.total > 0 && <span className="ml-2 text-muted-foreground/60">{pagination.total} universe{pagination.total !== 1 ? "s" : ""}</span>}
        </p>
      </div>

      {universes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No universes registered yet.</p>
      ) : (
        <>
          <UniverseCatalogueTable
            rows={universes.map((u) => ({
              master_id: u.master_id,
              title: u.title,
              description: u.description,
              muralCount: u.muralCount,
              occupancy: u.occupancy,
              withdrawable: u.withdrawable,
              openHref: u.occupancy === "curated" ? `/authority/universes/${u.master_id}` : curateHubHref(u.master_id),
              openLabel: u.occupancy === "curated" ? "Open Creative Studio" : "Open Curate Hub",
              identityHref: `/authority/universes/${u.master_id}/identity`,
            }))}
          />
          <PaginationBar meta={pagination} basePath="/authority/universes" />
        </>
      )}
    </div>
  );
}

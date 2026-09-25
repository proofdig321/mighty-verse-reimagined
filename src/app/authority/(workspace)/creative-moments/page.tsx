export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import { canWithdrawMaster } from "@/lib/assemble/withdraw";
import { CatalogueRecordList } from "@/components/assemble/catalogue-record-card";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { parsePage, pageMeta } from "@/lib/pagination";

async function getData(page: string | undefined) {
  const svc = getServiceClient();
  const pg = parsePage(page, undefined);

  const { data: masters, count } = await svc
    .from("master")
    .select("master_id, canonical_type, parent_master_id, current_state_id, created_at", { count: "exact" })
    .eq("canonical_type", "creative-moment")
    .order("created_at", { ascending: false })
    .range(pg.from, pg.to);

  if (!masters?.length) return { items: [], pagination: pageMeta(pg, count ?? 0) };

  const live = masters.filter((m) => m.current_state_id);
  if (!live.length) return { items: [], pagination: pageMeta(pg, count ?? 0) };

  const ids = live.map((m) => m.master_id);
  const parentIds = [...new Set(masters.map((m) => m.parent_master_id).filter(Boolean))] as string[];

  const [{ data: presentations }, { data: projPresentations }, { data: parentPresentations }, { data: projections }] = await Promise.all([
    svc.from("work_presentation").select("master_id, title, description").in("master_id", ids),
    svc.from("projection_presentation").select("projection_id, title").neq("title", ""),
    parentIds.length
      ? svc.from("work_presentation").select("master_id, title").in("master_id", parentIds)
      : Promise.resolve({ data: [] }),
    svc.from("projection").select("projection_id, master_id").in("master_id", ids),
  ]);

  return {
    items: live.map((m) => {
      const pres = (presentations ?? []).find((p) => p.master_id === m.master_id);
      const proj = (projections ?? []).find((p) => p.master_id === m.master_id);
      const projPres = proj ? (projPresentations ?? []).find((p) => p.projection_id === proj.projection_id) : null;
      const parentPres = m.parent_master_id ? (parentPresentations ?? []).find((p) => p.master_id === m.parent_master_id) : null;
      const title = pres?.title ?? projPres?.title ?? null;
      return {
        master_id: m.master_id,
        parent_master_id: m.parent_master_id,
        title,
        description: pres?.description ?? null,
        parentTitle: parentPres?.title ?? null,
        hasExperience: !!proj,
        withdrawable: canWithdrawMaster(m.master_id, m.current_state_id),
      };
    }),
    pagination: pageMeta(pg, count ?? 0),
  };
}

export default async function CreativeMomentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const { page } = await searchParams;
  const { items: moments, pagination } = await getData(page);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Canonical</p>
        <h1 className="text-3xl font-semibold tracking-tight">Creative Moments</h1>
        <p className="text-sm text-muted-foreground">
          Canonical Creative Moments. Each belongs to a Universe. A Creative Moment does not require media — its projection is its representation.
          Edit opens the record. Super Hero Ego moments cannot be withdrawn.
          {pagination.total > 0 && <span className="ml-2 text-muted-foreground/60">{pagination.total} moment{pagination.total !== 1 ? "s" : ""}</span>}
        </p>
      </div>

      {moments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No creative moments registered yet.</p>
      ) : (
        <>
          <CatalogueRecordList
            label="Creative Moments"
            items={moments.map((m) => ({
              masterId: m.master_id,
              kicker: "Creative Moment",
              title: m.title,
              untitled: "Untitled moment",
              description: m.description,
              badges: [m.hasExperience ? "Experience created" : "Experience missing"],
              meta: [
                {
                  label: "Universe",
                  value: m.parentTitle ?? "No parent",
                  href: m.parentTitle && m.parent_master_id ? `/authority/universes/${m.parent_master_id}` : undefined,
                },
              ],
              editHref: `/authority/${m.master_id}`,
              withdrawable: m.withdrawable,
            }))}
          />
          <PaginationBar meta={pagination} basePath="/authority/creative-moments" />
        </>
      )}
    </div>
  );
}

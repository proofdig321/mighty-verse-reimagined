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
    .eq("canonical_type", "mural")
    .order("created_at", { ascending: false })
    .range(pg.from, pg.to);

  if (!masters?.length) return { items: [], pagination: pageMeta(pg, count ?? 0) };

  const live = masters.filter((m) => m.current_state_id);
  if (!live.length) return { items: [], pagination: pageMeta(pg, count ?? 0) };

  const ids = live.map((m) => m.master_id);
  const parentIds = [...new Set(live.map((m) => m.parent_master_id).filter(Boolean))] as string[];

  const [{ data: presentations }, { data: parentPresentations }, { data: scenes }] = await Promise.all([
    svc.from("work_presentation").select("master_id, title").in("master_id", ids),
    parentIds.length
      ? svc.from("work_presentation").select("master_id, title").in("master_id", parentIds)
      : Promise.resolve({ data: [] }),
    svc.from("master").select("master_id, parent_master_id").eq("canonical_type", "scene").in("parent_master_id", ids),
  ]);

  return {
    items: live.map((m) => {
      const pres = (presentations ?? []).find((p) => p.master_id === m.master_id);
      const parentPres = m.parent_master_id ? (parentPresentations ?? []).find((p) => p.master_id === m.parent_master_id) : null;
      const sceneCount = (scenes ?? []).filter((s) => s.parent_master_id === m.master_id).length;
      return {
        master_id: m.master_id,
        parent_master_id: m.parent_master_id,
        current_state_id: m.current_state_id,
        title: pres?.title ?? null,
        universeTitle: parentPres?.title ?? null,
        sceneCount,
        withdrawable: canWithdrawMaster(m.master_id, m.current_state_id),
      };
    }),
    pagination: pageMeta(pg, count ?? 0),
  };
}

export default async function MuralsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const { page } = await searchParams;
  const { items: murals, pagination } = await getData(page);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Canonical</p>
        <h1 className="text-3xl font-semibold tracking-tight">Murals</h1>
        <p className="text-sm text-muted-foreground">
          Canonical Murals. Each Mural belongs to a Universe and contains Scenes.
          Edit opens the record. Withdraw removes a Mural from Discover — records stay. Super Hero Ego cannot be withdrawn.
          {pagination.total > 0 && <span className="ml-2 text-muted-foreground/60">{pagination.total} mural{pagination.total !== 1 ? "s" : ""}</span>}
        </p>
      </div>

      {murals.length === 0 ? (
        <p className="text-sm text-muted-foreground">No murals registered yet.</p>
      ) : (
        <>
          <CatalogueRecordList
            label="Murals"
            items={murals.map((m) => ({
              masterId: m.master_id,
              kicker: "Mural",
              title: m.title,
              untitled: "Untitled mural",
              badges: [`${m.sceneCount} Scene${m.sceneCount === 1 ? "" : "s"}`],
              meta: [
                {
                  label: "Universe",
                  value: m.universeTitle ?? "No parent",
                  href: m.universeTitle && m.parent_master_id ? `/authority/universes/${m.parent_master_id}` : undefined,
                },
              ],
              editHref: `/authority/${m.master_id}`,
              withdrawable: m.withdrawable,
            }))}
          />
          <PaginationBar meta={pagination} basePath="/authority/murals" />
        </>
      )}
    </div>
  );
}

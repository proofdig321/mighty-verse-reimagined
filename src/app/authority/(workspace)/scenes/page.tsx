export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import { formatDuration } from "@/lib/media/timing";
import SceneOrderClient from "./scene-order-client";
import { canWithdrawMaster } from "@/lib/assemble/withdraw";
import { CatalogueRecordList } from "@/components/assemble/catalogue-record-card";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { parsePage, pageMeta } from "@/lib/pagination";

function formatMs(ms: number | null) {
  if (ms == null) return null;
  return formatDuration(ms / 1000);
}

async function getData(page: string | undefined) {
  const svc = getServiceClient();
  const pg = parsePage(page, undefined);

  const { data: masters, count } = await svc
    .from("master")
    .select("master_id, canonical_type, parent_master_id, sort_order, current_state_id, created_at", { count: "exact" })
    .eq("canonical_type", "scene")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .range(pg.from, pg.to);

  if (!masters?.length) return { items: [], pagination: pageMeta(pg, count ?? 0) };

  const live = masters.filter((m) => m.current_state_id);
  if (!live.length) return { items: [], pagination: pageMeta(pg, count ?? 0) };

  const ids = live.map((m) => m.master_id);
  const parentIds = [...new Set(masters.map((m) => m.parent_master_id).filter(Boolean))] as string[];

  const [{ data: presentations }, { data: parentPresentations }, { data: projections }] = await Promise.all([
    svc.from("work_presentation").select("master_id, title").in("master_id", ids),
    parentIds.length
      ? svc.from("work_presentation").select("master_id, title").in("master_id", parentIds)
      : Promise.resolve({ data: [] }),
    svc.from("projection").select("projection_id, master_id").in("master_id", ids),
  ]);

  const projIds = (projections ?? []).map((p) => p.projection_id);
  const { data: bindings } = projIds.length
    ? await svc
        .from("projection_media_binding")
        .select("projection_id, start_ms, end_ms, media_asset(storage_ref)")
        .in("projection_id", projIds)
    : { data: [] };

  return {
    items: live.map((m) => {
      const pres = (presentations ?? []).find((p) => p.master_id === m.master_id);
      const parentPres = m.parent_master_id ? (parentPresentations ?? []).find((p) => p.master_id === m.parent_master_id) : null;
      const proj = (projections ?? []).find((p) => p.master_id === m.master_id);
      const binding = proj ? (bindings ?? []).find((b) => b.projection_id === proj.projection_id) : null;
      const asset = binding?.media_asset as { storage_ref: string } | null | undefined;
      const playable = !!asset?.storage_ref && !asset.storage_ref.startsWith("seed:placeholder:");
      return {
        master_id: m.master_id,
        parent_master_id: m.parent_master_id,
        sort_order: m.sort_order ?? null,
        title: pres?.title ?? null,
        muralTitle: parentPres?.title ?? null,
        startMs: binding?.start_ms ?? null,
        endMs: binding?.end_ms ?? null,
        playable,
        withdrawable: canWithdrawMaster(m.master_id, m.current_state_id),
      };
    }),
    pagination: pageMeta(pg, count ?? 0),
  };
}

export default async function ScenesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const { page } = await searchParams;
  const { items: scenes, pagination } = await getData(page);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Canonical</p>
        <h1 className="text-3xl font-semibold tracking-tight">Scenes</h1>
        <p className="text-sm text-muted-foreground">
          Canonical Scenes. Each Scene belongs to a Mural. Timing is a media-realization observation, not canonical Scene identity.
          Edit opens the record. Withdraw removes a Scene from Discover — records stay. Super Hero Ego Scenes cannot be withdrawn.
          {pagination.total > 0 && <span className="ml-2 text-muted-foreground/60">{pagination.total} scene{pagination.total !== 1 ? "s" : ""}</span>}
        </p>
      </div>

      {scenes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No scenes registered yet.</p>
      ) : (
        <>
          <SceneOrderClient scenes={scenes.map((s) => ({ master_id: s.master_id, title: s.title, sort_order: s.sort_order }))} />

          <CatalogueRecordList
            label="Scenes"
            items={scenes.map((s) => ({
              masterId: s.master_id,
              kicker: "Scene",
              title: s.title,
              untitled: "Untitled scene",
              badges: [s.playable ? "Playable" : "Missing media"],
              meta: [
                {
                  label: "Mural",
                  value: s.muralTitle ?? "No parent",
                  href: s.muralTitle && s.parent_master_id ? `/authority/${s.parent_master_id}` : undefined,
                },
                {
                  label: "Timing",
                  value: s.startMs != null && s.endMs != null ? `${formatMs(s.startMs)} → ${formatMs(s.endMs)}` : "Not set",
                },
              ],
              editHref: `/authority/${s.master_id}`,
              withdrawable: s.withdrawable,
            }))}
          />
          <PaginationBar meta={pagination} basePath="/authority/scenes" />
        </>
      )}
    </div>
  );
}

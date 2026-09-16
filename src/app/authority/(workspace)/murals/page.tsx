export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import { canWithdrawMaster } from "@/lib/assemble/withdraw";
import { CatalogueRecordCard } from "@/components/assemble/catalogue-record-card";
import { PaginatedItems } from "@/components/assemble/collection-pager";

async function getData() {
  const svc = getServiceClient();
  const { data: masters } = await svc
    .from("master")
    .select("master_id, canonical_type, parent_master_id, current_state_id, created_at")
    .eq("canonical_type", "mural")
    .order("created_at", { ascending: false });

  if (!masters?.length) return [];

  const live = masters.filter((m) => m.current_state_id);
  if (!live.length) return [];

  const ids = live.map((m) => m.master_id);
  const parentIds = [...new Set(live.map((m) => m.parent_master_id).filter(Boolean))] as string[];

  const [{ data: presentations }, { data: parentPresentations }, { data: scenes }] = await Promise.all([
    svc.from("work_presentation").select("master_id, title").in("master_id", ids),
    parentIds.length
      ? svc.from("work_presentation").select("master_id, title").in("master_id", parentIds)
      : Promise.resolve({ data: [] }),
    svc.from("master").select("master_id, parent_master_id").eq("canonical_type", "scene").in("parent_master_id", ids),
  ]);

  return live.map((m) => {
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
  });
}

export default async function MuralsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const murals = await getData();

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Canonical</p>
        <h1 className="text-3xl font-semibold tracking-tight">Murals</h1>
        <p className="text-sm text-muted-foreground">
          Canonical Murals. Each Mural belongs to a Universe and contains Scenes.
          Edit opens the record. Withdraw removes a Mural from Discover — records stay. Super Hero Ego cannot be withdrawn.
          {murals.length > 0 && <span className="ml-2 text-muted-foreground/60">{murals.length} mural{murals.length !== 1 ? "s" : ""}</span>}
        </p>
      </div>

      {murals.length === 0 ? (
        <p className="text-sm text-muted-foreground">No murals registered yet.</p>
      ) : (
        <PaginatedItems items={murals} label="Murals">
          {(page) => (
            <ul className="grid gap-3 md:grid-cols-2">
              {page.map((m) => (
                <li key={m.master_id}>
                  <CatalogueRecordCard
                    kicker="Mural"
                    title={m.title}
                    untitled="Untitled mural"
                    badges={[`${m.sceneCount} Scene${m.sceneCount === 1 ? "" : "s"}`]}
                    meta={[
                      {
                        label: "Universe",
                        value: m.universeTitle && m.parent_master_id ? (
                          <a href={`/authority/universes/${m.parent_master_id}`} className="hover:underline">
                            {m.universeTitle}
                          </a>
                        ) : (
                          <span className="italic text-muted-foreground">No parent</span>
                        ),
                      },
                    ]}
                    editHref={`/authority/${m.master_id}`}
                    masterId={m.master_id}
                    withdrawable={m.withdrawable}
                  />
                </li>
              ))}
            </ul>
          )}
        </PaginatedItems>
      )}
    </div>
  );
}

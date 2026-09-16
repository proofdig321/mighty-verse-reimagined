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
    .eq("canonical_type", "creative-moment")
    .order("created_at", { ascending: false });

  if (!masters?.length) return [];

  const live = masters.filter((m) => m.current_state_id);
  if (!live.length) return [];

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

  return live.map((m) => {
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
  });
}

export default async function CreativeMomentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const moments = await getData();

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Canonical</p>
        <h1 className="text-3xl font-semibold tracking-tight">Creative Moments</h1>
        <p className="text-sm text-muted-foreground">
          Canonical Creative Moments. Each belongs to a Universe. A Creative Moment does not require media — its projection is its representation.
          Edit opens the record. Super Hero Ego moments cannot be withdrawn.
          {moments.length > 0 && <span className="ml-2 text-muted-foreground/60">{moments.length} moment{moments.length !== 1 ? "s" : ""}</span>}
        </p>
      </div>

      {moments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No creative moments registered yet.</p>
      ) : (
        <PaginatedItems items={moments} label="Creative Moments">
          {(page) => (
            <ul className="grid gap-3 md:grid-cols-2">
              {page.map((m) => (
                <li key={m.master_id}>
                  <CatalogueRecordCard
                    kicker="Creative Moment"
                    title={m.title}
                    untitled="Untitled moment"
                    description={m.description}
                    badges={[m.hasExperience ? "Experience created" : "Experience missing"]}
                    meta={[
                      {
                        label: "Universe",
                        value: m.parentTitle && m.parent_master_id ? (
                          <a href={`/authority/universes/${m.parent_master_id}`} className="hover:underline">
                            {m.parentTitle}
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

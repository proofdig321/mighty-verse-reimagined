export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import { ChevronRight } from "lucide-react";
import { formatDuration } from "@/lib/media/timing";

function formatMs(ms: number | null) {
  if (ms == null) return null;
  return formatDuration(ms / 1000);
}

async function getData() {
  const svc = getServiceClient();
  const { data: masters } = await svc
    .from("master")
    .select("master_id, canonical_type, parent_master_id, created_at")
    .eq("canonical_type", "scene")
    .order("created_at", { ascending: false });

  if (!masters?.length) return [];

  const ids = masters.map((m) => m.master_id);
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

  return masters.map((m) => {
    const pres = (presentations ?? []).find((p) => p.master_id === m.master_id);
    const parentPres = m.parent_master_id ? (parentPresentations ?? []).find((p) => p.master_id === m.parent_master_id) : null;
    const proj = (projections ?? []).find((p) => p.master_id === m.master_id);
    const binding = proj ? (bindings ?? []).find((b) => b.projection_id === proj.projection_id) : null;
    const asset = binding?.media_asset as { storage_ref: string } | null | undefined;
    const playable = !!asset?.storage_ref && !asset.storage_ref.startsWith("seed:placeholder:");
    return {
      master_id: m.master_id,
      parent_master_id: m.parent_master_id,
      title: pres?.title ?? null,
      muralTitle: parentPres?.title ?? null,
      startMs: binding?.start_ms ?? null,
      endMs: binding?.end_ms ?? null,
      playable,
    };
  });
}

export default async function ScenesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const scenes = await getData();

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Canonical</p>
        <h1 className="text-3xl font-semibold tracking-tight">Scenes</h1>
        <p className="text-sm text-muted-foreground">
          Canonical Scenes. Each Scene belongs to a Mural. Timing is a media-realization observation, not canonical Scene identity.
          {scenes.length > 0 && <span className="ml-2 text-muted-foreground/60">{scenes.length} scene{scenes.length !== 1 ? "s" : ""}</span>}
        </p>
      </div>

      {scenes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No scenes registered yet.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/20">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Scene</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Mural</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Timing</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Media</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {scenes.map((s) => (
                <tr key={s.master_id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {s.title ?? <span className="italic text-muted-foreground">Untitled scene</span>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground text-xs">
                    {s.muralTitle ? (
                      <a href={`/authority/${s.parent_master_id}`} className="hover:text-foreground transition-colors">
                        {s.muralTitle}
                      </a>
                    ) : (
                      <span className="italic">No parent</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground font-mono">
                    {s.startMs != null && s.endMs != null
                      ? <>{formatMs(s.startMs)} → {formatMs(s.endMs)}</>
                      : <span className="italic not-italic font-sans text-muted-foreground/50">Not set</span>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {s.playable
                      ? <span className="text-xs text-emerald-400">Playable</span>
                      : <span className="text-xs text-muted-foreground/50">Missing</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/authority/${s.master_id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Open <ChevronRight size={13} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

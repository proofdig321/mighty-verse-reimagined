export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

async function getData() {
  const svc = getServiceClient();
  const { data: masters } = await svc
    .from("master")
    .select("master_id, canonical_type, parent_master_id, created_at")
    .eq("canonical_type", "creative-moment")
    .order("created_at", { ascending: false });

  if (!masters?.length) return [];

  const ids = masters.map((m) => m.master_id);
  const parentIds = [...new Set(masters.map((m) => m.parent_master_id).filter(Boolean))] as string[];

  const [{ data: presentations }, { data: projPresentations }, { data: parentPresentations }, { data: projections }] = await Promise.all([
    svc.from("work_presentation").select("master_id, title, description").in("master_id", ids),
    svc.from("projection_presentation").select("projection_id, title").neq("title", ""),
    parentIds.length
      ? svc.from("work_presentation").select("master_id, title").in("master_id", parentIds)
      : Promise.resolve({ data: [] }),
    svc.from("projection").select("projection_id, master_id").in("master_id", ids),
  ]);

  return masters.map((m) => {
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
          {moments.length > 0 && <span className="ml-2 text-muted-foreground/60">{moments.length} moment{moments.length !== 1 ? "s" : ""}</span>}
        </p>
      </div>

      {moments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No creative moments registered yet.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/20">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Creative Moment</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Universe</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Experience</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {moments.map((m) => (
                <tr key={m.master_id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">
                      {m.title ?? <span className="italic text-muted-foreground">Untitled moment</span>}
                    </p>
                    {m.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{m.description}</p>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground text-xs">
                    {m.parentTitle ? (
                      <a href={`/authority/${m.parent_master_id}`} className="hover:text-foreground transition-colors">
                        {m.parentTitle}
                      </a>
                    ) : (
                      <span className="italic">No parent</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {m.hasExperience
                      ? <Badge variant="secondary">Created</Badge>
                      : <Badge variant="outline">Missing</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/authority/${m.master_id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
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

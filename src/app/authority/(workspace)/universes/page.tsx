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
    .select("master_id, canonical_type, created_at")
    .eq("canonical_type", "universe")
    .order("created_at", { ascending: false });

  if (!masters?.length) return [];

  const ids = masters.map((m) => m.master_id);
  const [{ data: presentations }, { data: children }] = await Promise.all([
    svc.from("work_presentation").select("master_id, title, description").in("master_id", ids),
    svc.from("master").select("master_id, canonical_type, parent_master_id").in("parent_master_id", ids),
  ]);

  return masters.map((m) => {
    const pres = (presentations ?? []).find((p) => p.master_id === m.master_id);
    const muralCount = (children ?? []).filter((c) => c.parent_master_id === m.master_id && c.canonical_type === "mural").length;
    const momentCount = (children ?? []).filter((c) => c.parent_master_id === m.master_id && c.canonical_type === "creative-moment").length;
    return { master_id: m.master_id, title: pres?.title ?? null, description: pres?.description ?? null, muralCount, momentCount };
  });
}

export default async function UniversesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const universes = await getData();

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Canonical</p>
        <h1 className="text-3xl font-semibold tracking-tight">Universes</h1>
        <p className="text-sm text-muted-foreground">
          Top-level canonical containers. Each Universe establishes a distinct creative world.
          {universes.length > 0 && <span className="ml-2 text-muted-foreground/60">{universes.length} universe{universes.length !== 1 ? "s" : ""}</span>}
        </p>
      </div>

      {universes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No universes registered yet.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/20">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Universe</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Murals</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Creative Moments</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {universes.map((u) => (
                <tr key={u.master_id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{u.title ?? <span className="italic text-muted-foreground">Untitled universe</span>}</p>
                    {u.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{u.description}</p>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge variant="outline">{u.muralCount}</Badge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Badge variant="outline">{u.momentCount}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/authority/${u.master_id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
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

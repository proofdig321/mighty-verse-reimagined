export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  classifyUniverseOccupancy,
  hasSourceMediaFromSession,
  occupancyLabel,
  type UniverseOccupancy,
} from "@/lib/assemble/occupancy";
import { isProtectedMaster } from "@/lib/assemble/protected-work";
import { curateHubHref } from "@/lib/assemble/studio";
import { WithdrawWork } from "@/components/assemble/withdraw-work";

type UniverseRow = {
  master_id: string;
  title: string | null;
  description: string | null;
  muralCount: number;
  momentCount: number;
  occupancy: UniverseOccupancy;
  withdrawable: boolean;
};

async function getData(): Promise<UniverseRow[]> {
  const svc = getServiceClient();
  const { data: masters } = await svc
    .from("master")
    .select("master_id, canonical_type, current_state_id, created_at")
    .eq("canonical_type", "universe")
    .order("created_at", { ascending: false });

  if (!masters?.length) return [];

  const ids = masters.map((m) => m.master_id);
  const [{ data: presentations }, { data: children }, { data: sessions }] = await Promise.all([
    svc.from("work_presentation").select("master_id, title, description").in("master_id", ids),
    svc.from("master").select("master_id, canonical_type, parent_master_id").in("parent_master_id", ids),
    svc.from("media_upload_session").select("master_id, phase, asset_id, updated_at").in("master_id", ids),
  ]);

  const muralIds = (children ?? []).filter((child) => child.canonical_type === "mural").map((child) => child.master_id);
  const { data: muralProjs } = muralIds.length
    ? await svc.from("projection").select("projection_id, master_id").in("master_id", muralIds)
    : { data: [] };
  const muralProjIds = (muralProjs ?? []).map((row) => row.projection_id);
  const { data: muralBindings } = muralProjIds.length
    ? await svc.from("projection_media_binding").select("projection_id, asset_id").in("projection_id", muralProjIds).eq("binding_type", "primary")
    : { data: [] };

  const latestSession = new Map<string, { phase: string | null; asset_id: string | null }>();
  for (const session of [...(sessions ?? [])].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))) {
    if (session.master_id && !latestSession.has(session.master_id)) {
      latestSession.set(session.master_id, { phase: session.phase, asset_id: session.asset_id });
    }
  }

  return masters
    .map((m) => {
      const pres = (presentations ?? []).find((p) => p.master_id === m.master_id);
      const muralIdsForWork = (children ?? [])
        .filter((c) => c.parent_master_id === m.master_id && c.canonical_type === "mural")
        .map((c) => c.master_id);
      const muralCount = muralIdsForWork.length;
      const momentCount = (children ?? []).filter((c) => c.parent_master_id === m.master_id && c.canonical_type === "creative-moment").length;
      const muralHasPlayableMedia = muralIdsForWork.some((muralId) => {
        const projection = (muralProjs ?? []).find((item) => item.master_id === muralId);
        return Boolean(projection && (muralBindings ?? []).some((binding) => binding.projection_id === projection.projection_id && binding.asset_id));
      });
      const session = latestSession.get(m.master_id);
      const occupancy = classifyUniverseOccupancy({
        title: pres?.title ?? null,
        currentStateId: m.current_state_id,
        muralHasPlayableMedia,
        hasSourceMedia: muralHasPlayableMedia || hasSourceMediaFromSession({
          phase: session?.phase,
          assetId: session?.asset_id,
        }),
      });
      return {
        master_id: m.master_id,
        title: pres?.title ?? null,
        description: pres?.description ?? null,
        muralCount,
        momentCount,
        occupancy,
        withdrawable: occupancy !== "withdrawn" && !isProtectedMaster(m.master_id),
      };
    })
    .filter((row) => row.occupancy !== "withdrawn");
}

export default async function UniversesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/authority/universes");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in?next=/authority/universes");

  const universes = await getData();

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Creative Studio</p>
        <h1 className="text-3xl font-semibold tracking-tight">Universes</h1>
        <p className="text-sm text-muted-foreground">
          Curated work opens Creative Studio. In-progress work stays on Curate Hub. Withdraw removes a work from Discover — records stay. Super Hero Ego cannot be withdrawn.
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
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Occupancy</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Murals</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {universes.map((u) => (
                <tr key={u.master_id} className="hover:bg-muted/20 transition-colors" data-occupancy={u.occupancy}>
                  <td className="px-4 py-3">
                    <Link
                      href={u.occupancy === "curated" ? `/authority/universes/${u.master_id}` : curateHubHref(u.master_id)}
                      className="font-medium text-foreground hover:underline"
                    >
                      {u.title ?? <span className="italic text-muted-foreground">Untitled universe</span>}
                    </Link>
                    {u.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{u.description}</p>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge variant="outline">{occupancyLabel(u.occupancy)}</Badge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Badge variant="outline">{u.muralCount}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      {u.withdrawable ? <WithdrawWork masterId={u.master_id} title={u.title} /> : null}
                      <Link
                        href={u.occupancy === "curated" ? `/authority/universes/${u.master_id}` : curateHubHref(u.master_id)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {u.occupancy === "curated" ? "Open Creative Studio" : "Open Curate Hub"} <ChevronRight size={13} />
                      </Link>
                    </div>
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

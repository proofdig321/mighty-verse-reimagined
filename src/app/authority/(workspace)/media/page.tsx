export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import { ChevronRight, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/media/timing";

async function getData() {
  const svc = getServiceClient();

  const [{ data: assets }, { data: intakes }] = await Promise.all([
    svc.from("media_asset").select("asset_id, asset_type, storage_ref, format, duration_ms, rights_holder_ref, rights_basis, created_at").order("created_at", { ascending: false }),
    svc.from("media_intake").select("intake_id, asset_id, title, work_type, visibility, creator_name, created_at").order("created_at", { ascending: false }),
  ]);

  const assetIds = (assets ?? []).filter((a) => !a.storage_ref.startsWith("seed:placeholder:")).map((a) => a.asset_id);
  const { data: bindings } = assetIds.length
    ? await svc.from("projection_media_binding").select("asset_id, projection_id").in("asset_id", assetIds)
    : { data: [] };

  const projIds = [...new Set((bindings ?? []).map((b) => b.projection_id))];
  const { data: presentations } = projIds.length
    ? await svc.from("projection_presentation").select("projection_id, title").in("projection_id", projIds)
    : { data: [] };

  const assetToWorkTitle = new Map<string, string>();
  for (const b of bindings ?? []) {
    const pres = (presentations ?? []).find((p) => p.projection_id === b.projection_id);
    if (pres?.title) assetToWorkTitle.set(b.asset_id, pres.title);
  }

  const intakeByAsset = new Map<string, { title: string; work_type: string }>();
  for (const i of intakes ?? []) {
    if (i.asset_id) intakeByAsset.set(i.asset_id, { title: i.title, work_type: i.work_type });
  }

  const realAssets = (assets ?? [])
    .filter((a) => !a.storage_ref.startsWith("seed:placeholder:"))
    .map((a) => ({
      asset_id: a.asset_id,
      asset_type: a.asset_type,
      storage_ref: a.storage_ref,
      format: a.format,
      duration_ms: a.duration_ms,
      rights_holder_ref: a.rights_holder_ref,
      rights_basis: a.rights_basis,
      created_at: a.created_at,
      workTitle: assetToWorkTitle.get(a.asset_id) ?? intakeByAsset.get(a.asset_id)?.title ?? null,
      intakeWorkType: intakeByAsset.get(a.asset_id)?.work_type ?? null,
    }));

  const unlinkedIntakes = (intakes ?? []).filter((i) => !i.asset_id);

  return { assets: realAssets, unlinkedIntakes };
}

export default async function MediaGalleryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const { assets, unlinkedIntakes } = await getData();

  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Media</p>
          <h1 className="text-3xl font-semibold tracking-tight">Media Gallery</h1>
          <p className="text-sm text-muted-foreground">
            Audio and video assets in the operational scope.
            {assets.length > 0 && <span className="ml-2 text-muted-foreground/60">{assets.length} asset{assets.length !== 1 ? "s" : ""}</span>}
          </p>
        </div>
        <Link
          href="/authority/media/intake"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors shrink-0"
        >
          <Plus size={13} /> Add Media
        </Link>
      </div>

      {/* Assets */}
      {assets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No media assets found. <Link href="/authority/media/intake" className="underline hover:text-foreground">Add media →</Link></p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/20">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Asset</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Type</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Duration</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Rights</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {assets.map((a) => (
                <tr key={a.asset_id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">
                      {a.workTitle ?? <span className="font-mono text-xs text-muted-foreground">{a.storage_ref.slice(0, 16)}…</span>}
                    </p>
                    {a.intakeWorkType && <p className="text-xs text-muted-foreground">{a.intakeWorkType}</p>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge variant="outline">{a.asset_type}</Badge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                    {a.duration_ms ? formatDuration(a.duration_ms / 1000) : <span className="italic">Unknown</span>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {a.rights_holder_ref
                      ? <span className="text-xs text-emerald-400">On file</span>
                      : <span className="text-xs text-amber-400">Needs review</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/authority/media/${a.asset_id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Open <ChevronRight size={13} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Unlinked intake records */}
      {unlinkedIntakes.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Intake Records — No Asset Yet
            <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground/60">{unlinkedIntakes.length} record{unlinkedIntakes.length !== 1 ? "s" : ""}</span>
          </p>
          <p className="text-xs text-muted-foreground">These intake records exist but have not yet been linked to a media asset. Upload a video to complete the workflow.</p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/20">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Title</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Type</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {unlinkedIntakes.map((i) => (
                  <tr key={i.intake_id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{i.title}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground text-xs">{i.work_type}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">{new Date(i.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

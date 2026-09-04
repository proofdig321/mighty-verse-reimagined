export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/media/timing";
import { deriveMediaReadiness } from "@/lib/media/readiness";
import MediaLibraryClient from "./media-library-client";

export type MediaLibraryItem = {
  asset_id: string;
  asset_type: string;
  storage_ref: string;
  format: string | null;
  duration_ms: number | null;
  rights_holder_ref: string | null;
  rights_basis: string | null;
  created_at: string;
  // Resolved presentation
  title: string | null;
  work_type: string | null;
  isrc: string | null;
  isrc_status: string | null;
  has_credits: boolean;
  // Canonical context
  universe_title: string | null;
  mural_title: string | null;
  scene_title: string | null;
  canonical_context_type: string | null;
  // Thumbnail from Livepeer (derived from storage_ref)
  thumbnail_url: string | null;
  // Readiness
  readiness_overall: string;
  readiness_blockers: string[];
};

async function getData() {
  const svc = getServiceClient();

  const [{ data: assets }, { data: intakes }] = await Promise.all([
    svc
      .from("media_asset")
      .select("asset_id, asset_type, storage_ref, format, duration_ms, rights_holder_ref, rights_basis, created_at")
      .order("created_at", { ascending: false }),
    svc
      .from("media_intake")
      .select("intake_id, asset_id, title, work_type, isrc, isrc_status, creator_name, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const realAssets = (assets ?? []).filter(
    (a) => !a.storage_ref.startsWith("seed:placeholder:")
  );
  const assetIds = realAssets.map((a) => a.asset_id);

  // Credits presence
  const { data: creditCounts } = assetIds.length
    ? await svc
        .from("media_intake_credit")
        .select("intake_id")
        .in(
          "intake_id",
          (intakes ?? []).filter((i) => i.asset_id && assetIds.includes(i.asset_id)).map((i) => i.intake_id)
        )
    : { data: [] };

  const intakesWithCredits = new Set((creditCounts ?? []).map((c) => c.intake_id));

  // Canonical context via projection_media_binding → projection → master hierarchy
  const { data: bindings } = assetIds.length
    ? await svc
        .from("projection_media_binding")
        .select("asset_id, projection_id")
        .in("asset_id", assetIds)
    : { data: [] };

  const projIds = [...new Set((bindings ?? []).map((b) => b.projection_id))];
  const { data: projections } = projIds.length
    ? await svc
        .from("projection")
        .select("projection_id, master_id")
        .in("projection_id", projIds)
    : { data: [] };

  const masterIds = [...new Set((projections ?? []).map((p) => p.master_id))];
  const { data: masters } = masterIds.length
    ? await svc
        .from("master")
        .select("master_id, canonical_type, parent_master_id")
        .in("master_id", masterIds)
    : { data: [] };

  // Collect all ancestor master IDs for title resolution
  const parentIds = [...new Set((masters ?? []).map((m) => m.parent_master_id).filter(Boolean) as string[])];
  const grandparentIds: string[] = [];
  const { data: parentMasters } = parentIds.length
    ? await svc.from("master").select("master_id, canonical_type, parent_master_id").in("master_id", parentIds)
    : { data: [] };
  for (const pm of parentMasters ?? []) {
    if (pm.parent_master_id) grandparentIds.push(pm.parent_master_id);
  }
  const { data: grandparentMasters } = grandparentIds.length
    ? await svc.from("master").select("master_id, canonical_type").in("master_id", grandparentIds)
    : { data: [] };

  const allMasterIds = [
    ...masterIds,
    ...parentIds,
    ...grandparentIds,
  ].filter((id, i, arr) => arr.indexOf(id) === i);

  const { data: presentations } = allMasterIds.length
    ? await svc.from("work_presentation").select("master_id, title").in("master_id", allMasterIds)
    : { data: [] };

  const presMap = new Map((presentations ?? []).map((p) => [p.master_id, p.title]));
  const masterMap = new Map((masters ?? []).map((m) => [m.master_id, m]));
  const parentMasterMap = new Map((parentMasters ?? []).map((m) => [m.master_id, m]));
  const grandparentMasterMap = new Map((grandparentMasters ?? []).map((m) => [m.master_id, m]));

  // Build asset → canonical context
  const assetContext = new Map<string, { universe_title: string | null; mural_title: string | null; scene_title: string | null; canonical_context_type: string | null }>();
  for (const binding of bindings ?? []) {
    const proj = (projections ?? []).find((p) => p.projection_id === binding.projection_id);
    if (!proj) continue;
    const master = masterMap.get(proj.master_id);
    if (!master) continue;

    let universe_title: string | null = null;
    let mural_title: string | null = null;
    let scene_title: string | null = null;
    const ct = master.canonical_type;

    if (ct === "universe") {
      universe_title = presMap.get(master.master_id) ?? null;
    } else if (ct === "mural") {
      mural_title = presMap.get(master.master_id) ?? null;
      if (master.parent_master_id) universe_title = presMap.get(master.parent_master_id) ?? null;
    } else if (ct === "scene") {
      scene_title = presMap.get(master.master_id) ?? null;
      const parentMaster = parentMasterMap.get(master.parent_master_id ?? "");
      if (parentMaster) {
        mural_title = presMap.get(parentMaster.master_id) ?? null;
        if (parentMaster.parent_master_id) {
          universe_title = presMap.get(parentMaster.parent_master_id) ?? null;
        }
      }
    }

    assetContext.set(binding.asset_id, { universe_title, mural_title, scene_title, canonical_context_type: ct });
  }

  // Build intake map
  const intakeByAsset = new Map<string, { intake_id: string; asset_id: string | null; title: string; work_type: string; isrc: string | null; isrc_status: string | null; creator_name: string | null; created_at: string }>();
  for (const i of intakes ?? []) {
    if (i.asset_id) intakeByAsset.set(i.asset_id, i);
  }

  const items: MediaLibraryItem[] = realAssets.map((a) => {
    const intake = intakeByAsset.get(a.asset_id);
    const context = assetContext.get(a.asset_id);
    const isPlaceholder = a.storage_ref.startsWith("seed:placeholder:");
    const isThumbnail = a.storage_ref.startsWith("thumbnail:") || a.storage_ref.startsWith("http");
    const hasCredits = intake ? intakesWithCredits.has(intake.intake_id) : false;

    const readiness = deriveMediaReadiness({
      hasAsset: !isPlaceholder && !isThumbnail,
      isPlaceholder,
      hasRights: !!a.rights_holder_ref,
      hasCredits,
      isrcStatus: intake?.isrc_status ?? null,
      workType: intake?.work_type ?? null,
    });

    // Livepeer thumbnail: derive from playbackId (storage_ref for video assets)
    let thumbnail_url: string | null = null;
    if (!isThumbnail && !isPlaceholder && a.asset_type !== "thumbnail" && a.asset_type !== "metadata") {
      // Livepeer keyframe thumbnail pattern
      thumbnail_url = `https://vod-cdn.lp-playback.studio/${a.storage_ref}/thumbnails/keyframes_0.png`;
    } else if (isThumbnail) {
      thumbnail_url = a.storage_ref.startsWith("thumbnail:") ? null : a.storage_ref;
    }

    return {
      asset_id: a.asset_id,
      asset_type: a.asset_type,
      storage_ref: a.storage_ref,
      format: a.format,
      duration_ms: a.duration_ms,
      rights_holder_ref: a.rights_holder_ref,
      rights_basis: a.rights_basis,
      created_at: a.created_at,
      title: intake?.title ?? null,
      work_type: intake?.work_type ?? null,
      isrc: intake?.isrc ?? null,
      isrc_status: intake?.isrc_status ?? null,
      has_credits: hasCredits,
      universe_title: context?.universe_title ?? null,
      mural_title: context?.mural_title ?? null,
      scene_title: context?.scene_title ?? null,
      canonical_context_type: context?.canonical_context_type ?? null,
      thumbnail_url,
      readiness_overall: readiness.overall,
      readiness_blockers: readiness.blockers,
    };
  });

  const unlinkedIntakes = (intakes ?? []).filter((i) => !i.asset_id);

  return { items, unlinkedIntakes };
}

export default async function MediaGalleryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const { items, unlinkedIntakes } = await getData();

  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Media</p>
          <h1 className="text-3xl font-semibold tracking-tight">Media Library</h1>
          <p className="text-sm text-muted-foreground">
            Golden Shovel media catalogue — audio, video, and animation.
            {items.length > 0 && (
              <span className="ml-2 text-muted-foreground/60">
                {items.length} asset{items.length !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <Link
          href="/authority/media/intake"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors shrink-0"
        >
          <Plus size={13} /> Add Media
        </Link>
      </div>

      <MediaLibraryClient items={items} unlinkedIntakes={unlinkedIntakes} />
    </div>
  );
}

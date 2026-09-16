export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import { loadInspectWorkScope } from "@/lib/assemble/load-inspect-scope";
import {
  creativeSuiteSentinelHref,
  curateMuralHref,
  curateSentinelHref,
  curateStudioHref,
} from "@/lib/assemble/studio";
import { isInspectableAssetType } from "@/lib/media/inspect-persist";
import { listInspectionSessions } from "@/lib/media/sentinel";
import { buttonVariants } from "@/components/ui/button";
import { HierarchyBreadcrumb } from "@/components/assemble/breadcrumb";
import MediaInspectClient from "./media-inspect-client";

type AssetIdentity = {
  asset_id: string;
  title: string | null;
  provider: string;
  storage_ref: string;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  audio_presence: boolean | null;
  work_type: string | null;
};

async function getAssetIdentity(assetId: string): Promise<AssetIdentity | null> {
  const svc = getServiceClient();

  const { data: asset } = await svc
    .from("media_asset")
    .select("asset_id, asset_type, storage_ref, provider, duration_ms, width, height, audio_presence, intake_id")
    .eq("asset_id", assetId)
    .maybeSingle();

  if (!asset) return null;
  if (!asset.provider) return null;
  if (!isInspectableAssetType(asset.asset_type)) return null;

  const { data: intake } = asset.intake_id
    ? await svc.from("media_intake").select("title, work_type").eq("intake_id", asset.intake_id).maybeSingle()
    : { data: null };

  return {
    asset_id: asset.asset_id,
    title: intake?.title ?? null,
    provider: asset.provider,
    storage_ref: asset.storage_ref,
    duration_ms: asset.duration_ms,
    width: asset.width ?? null,
    height: asset.height ?? null,
    audio_presence: asset.audio_presence ?? null,
    work_type: intake?.work_type ?? null,
  };
}

export default async function MediaInspectPage({
  searchParams,
}: {
  searchParams: Promise<{ assetId?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const { assetId } = await searchParams;
  const inspectAssetId = typeof assetId === "string" && assetId.trim() ? assetId.trim() : null;

  const [workScope, assetIdentity, savedInspections] = await Promise.all([
    loadInspectWorkScope(inspectAssetId),
    inspectAssetId ? getAssetIdentity(inspectAssetId) : Promise.resolve(null),
    inspectAssetId ? listInspectionSessions(inspectAssetId) : Promise.resolve([]),
  ]);

  const curateHref = curateStudioHref(workScope.universe_id, inspectAssetId);
  const suiteSentinelHref = workScope.bound && workScope.universe_id
    ? creativeSuiteSentinelHref(workScope.universe_id)
    : null;
  const muralHref = workScope.universe_id && !workScope.mural_id
    ? curateMuralHref(workScope.universe_id)
    : null;
  const sentinelHref = workScope.universe_id
    ? curateSentinelHref(workScope.universe_id)
    : null;

  return (
    <div className="space-y-6">
      <HierarchyBreadcrumb
        items={[
          { label: "Authority", href: "/authority" },
          { label: "Curate", href: curateHref },
          { label: "Inspect" },
        ]}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Media Intelligence</p>
          <h1 className="text-3xl font-semibold tracking-tight">Media Inspection</h1>
          <p className="text-sm text-muted-foreground">
            Inspect a video asset — sample frames, detect visual changes, and save observational evidence
            against the media itself. Inspection is evidence only. No canonical state is modified.
          </p>
        </div>
        {inspectAssetId ? (
          <div className="flex flex-wrap gap-2">
            <Link href={curateHref} className={buttonVariants({ size: "sm" })}>
              <Wand2 size={14} />
              Continue in Curate
            </Link>
            {muralHref ? (
              <Link href={muralHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Register Mural
              </Link>
            ) : null}
            {sentinelHref && workScope.mural_id ? (
              <Link href={sentinelHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Open Sentinel
              </Link>
            ) : null}
            {suiteSentinelHref ? (
              <Link href={suiteSentinelHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Open Sentinel in Suite
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
      <MediaInspectClient
        canonicalScenes={workScope.scenes}
        workScope={workScope}
        assetIdentity={assetIdentity}
        savedInspections={savedInspections}
      />
    </div>
  );
}

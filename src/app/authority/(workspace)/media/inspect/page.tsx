export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import MediaInspectClient from "./media-inspect-client";

type CanonicalScene = {
  master_id: string;
  title: string | null;
  start_ms: number | null;
  end_ms: number | null;
};

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

async function getCanonicalScenes(): Promise<CanonicalScene[]> {
  const svc = getServiceClient();

  const { data: masters } = await svc
    .from("master")
    .select("master_id")
    .eq("canonical_type", "scene")
    .not("current_state_id", "is", null)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (!masters?.length) return [];

  const ids = masters.map((m) => m.master_id);

  const [{ data: presentations }, { data: projections }] = await Promise.all([
    svc.from("work_presentation").select("master_id, title").in("master_id", ids),
    svc.from("projection").select("master_id, projection_id").in("master_id", ids).eq("projection_type", "experiential"),
  ]);

  const projIds = (projections ?? []).map((p) => p.projection_id);
  const { data: bindings } = projIds.length
    ? await svc.from("projection_media_binding").select("projection_id, start_ms, end_ms").in("projection_id", projIds).eq("binding_type", "primary")
    : { data: [] };

  return masters.map((m) => {
    const proj = (projections ?? []).find((p) => p.master_id === m.master_id);
    const binding = proj ? (bindings ?? []).find((b) => b.projection_id === proj.projection_id) : null;
    return {
      master_id: m.master_id,
      title: (presentations ?? []).find((p) => p.master_id === m.master_id)?.title ?? null,
      start_ms: binding?.start_ms ?? null,
      end_ms: binding?.end_ms ?? null,
    };
  });
}

async function getAssetIdentity(assetId: string): Promise<AssetIdentity | null> {
  const svc = getServiceClient();

  const { data: asset } = await svc
    .from("media_asset")
    .select("asset_id, asset_type, storage_ref, provider, duration_ms, width, height, audio_presence, intake_id")
    .eq("asset_id", assetId)
    .maybeSingle();

  if (!asset) return null;
  if (!asset.provider) return null;
  // Accept original, video, and audio asset types
  const inspectable = ["original", "video", "audio"];
  if (!inspectable.includes(asset.asset_type)) return null;

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

  const [canonicalScenes, assetIdentity] = await Promise.all([
    getCanonicalScenes(),
    assetId ? getAssetIdentity(assetId) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Media Intelligence</p>
        <h1 className="text-3xl font-semibold tracking-tight">Media Inspection</h1>
        <p className="text-sm text-muted-foreground">
          Inspect a video asset — sample frames, detect visual changes, and compare candidate boundaries
          against existing canonical Scenes. Inspection is evidence only. No canonical state is modified.
        </p>
      </div>
      <MediaInspectClient
        canonicalScenes={canonicalScenes}
        assetIdentity={assetIdentity}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";

import { getServiceClient } from "@/lib/authority/validate";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { resolveThumbnail } from "@/lib/media/thumbnail";
import PageTopNav from "@/components/page-top-nav";
import EditorShell from "./editor-shell";
import type { LibraryScene } from "./types";

async function loadScenes(): Promise<LibraryScene[]> {
  const svc = getServiceClient();

  // Load all scenes ordered by canonical sort_order
  const { data: masters } = await svc
    .from("master")
    .select("master_id, parent_master_id, sort_order")
    .eq("canonical_type", "scene")
    .not("current_state_id", "is", null)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (!masters?.length) return [];

  const sceneIds = masters.map(m => m.master_id);
  const muralIds = [...new Set(masters.map(m => m.parent_master_id).filter(Boolean) as string[])];

  const [
    { data: presentations },
    { data: projections },
    { data: muralPres },
  ] = await Promise.all([
    svc.from("work_presentation").select("master_id, title, artwork_asset_id").in("master_id", sceneIds),
    svc.from("projection").select("master_id, projection_id").in("master_id", sceneIds).eq("projection_type", "experiential"),
    muralIds.length
      ? svc.from("work_presentation").select("master_id, title").in("master_id", muralIds)
      : Promise.resolve({ data: [] }),
  ]);

  const projIds = (projections ?? []).map(p => p.projection_id);
  const { data: bindings } = projIds.length
    ? await svc.from("projection_media_binding")
        .select("projection_id, asset_id, start_ms, end_ms")
        .in("projection_id", projIds)
        .eq("binding_type", "primary")
        .eq("access_level", "public")
    : { data: [] };

  const assetIds = [...new Set([
    ...(bindings ?? []).map(b => b.asset_id),
    ...(presentations ?? []).map(p => p.artwork_asset_id).filter(Boolean) as string[],
  ])];
  const [{ data: assets }, { data: variants }] = assetIds.length
    ? await Promise.all([
        svc.from("media_asset").select("asset_id, storage_ref, provider").in("asset_id", assetIds),
        svc.from("delivery_variant").select("asset_id, endpoint_ref").in("asset_id", assetIds),
      ])
    : [{ data: [] }, { data: [] }];

  return masters.map(m => {
    const pres = (presentations ?? []).find(p => p.master_id === m.master_id);
    const proj = (projections ?? []).find(p => p.master_id === m.master_id);
    const binding = proj ? (bindings ?? []).find(b => b.projection_id === proj.projection_id) : null;
    const muralTitle = m.parent_master_id
      ? (muralPres ?? []).find(p => p.master_id === m.parent_master_id)?.title ?? null
      : null;

    // Resolve playback_id and provider from binding asset
    const asset = binding
      ? (assets ?? []).find(a => a.asset_id === binding.asset_id) ?? null
      : null;
    const assetRef = asset?.storage_ref ?? null;
    const playbackId = assetRef && !assetRef.startsWith("seed:placeholder:") ? assetRef : null;
    const provider = asset?.provider ?? null;
    const hlsUrl = binding
      ? (variants ?? []).find(v => v.asset_id === binding.asset_id)?.endpoint_ref ?? null
      : null;

    // Resolve artwork
    const artworkRef = pres?.artwork_asset_id
      ? (assets ?? []).find(a => a.asset_id === pres.artwork_asset_id)?.storage_ref ?? null
      : null;

    const startMs = binding?.start_ms ?? null;
    const endMs = binding?.end_ms ?? null;
    const durationSec = startMs != null && endMs != null ? (endMs - startMs) / 1000 : null;

    const thumbnailUrl = resolveThumbnail({
      playbackId,
      startMs,
      artworkStorageRef: artworkRef,
    });

    return {
      masterId: m.master_id,
      projectionId: proj?.projection_id ?? "",
      title: pres?.title ?? null,
      muralTitle,
      playbackId,
      provider,
      hlsUrl,
      startMs,
      endMs,
      thumbnailUrl,
      durationSec,
    } satisfies LibraryScene;
  }).filter(s => s.projectionId !== "");
}

async function loadUserDecks(participantId: string | null) {
  if (!participantId) return [];
  const svc = getServiceClient();
  const { data } = await svc
    .from("user_deck")
    .select("deck_id, name, updated_at")
    .eq("participant_id", participantId)
    .order("updated_at", { ascending: false });
  return data ?? [];
}

export default async function EditorPage() {
  const [scenes, supabase] = await Promise.all([loadScenes(), createClient()]);
  const { data: { user } } = await supabase.auth.getUser();
  const participantId = user ? await getParticipantId(supabase) : null;
  const savedDecks = await loadUserDecks(participantId);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <PageTopNav activePath="/editor" />
      <div className="flex-1 min-h-0">
        <EditorShell
          scenes={scenes}
          initialDecks={savedDecks}
          isAuthenticated={!!user}
        />
      </div>
    </div>
  );
}

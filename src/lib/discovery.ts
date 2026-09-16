import { getServiceClient } from "@/lib/authority/validate";
import { isPlayableStorageRef } from "@/lib/assemble/protected-work";

export type DiscoveryUniverse = {
  master_id: string;
  canonical_type: string;
  canonical_state_version: number;
  authorisation_state: string;
  has_media: boolean;
  title: string | null;
  description: string | null;
  attribution_roles: string[];
  projections: DiscoveryProjection[];
  visual_playback_id: string | null;
  visual_provider: string | null;
};

export type DiscoveryProjection = {
  projection_id: string;
  projection_type: string;
  collectible_designated: boolean;
  has_media: boolean;
  title: string | null;
  visual_playback_id: string | null;
};

function mediaAsset(binding: { media_asset?: { storage_ref: string | null; provider: string | null }[] | { storage_ref: string | null; provider: string | null } | null }) {
  return Array.isArray(binding.media_asset) ? binding.media_asset[0] : binding.media_asset;
}

function mediaStorageRef(binding: Parameters<typeof mediaAsset>[0]) {
  return mediaAsset(binding)?.storage_ref ?? null;
}

function mediaProvider(binding: Parameters<typeof mediaAsset>[0]) {
  return mediaAsset(binding)?.provider ?? null;
}

export async function getDiscovery(): Promise<DiscoveryUniverse[]> {
  const svc = getServiceClient();

  const { data: masters } = await svc
    .from("master")
    .select("master_id, canonical_type, current_state_id, attribution_ref")
    .not("current_state_id", "is", null)
    .is("parent_master_id", null)
    .order("created_at", { ascending: false });

  if (!masters?.length) return [];

  const universeIds = masters.filter((m) => m.canonical_type === "universe").map((m) => m.master_id);
  const { data: muralChildren } = universeIds.length
    ? await svc
        .from("master")
        .select("master_id, parent_master_id")
        .eq("canonical_type", "mural")
        .in("parent_master_id", universeIds)
        .not("current_state_id", "is", null)
    : { data: [] };
  const muralIds = (muralChildren ?? []).map((row) => row.master_id);
  const { data: muralProjections } = muralIds.length
    ? await svc
        .from("projection")
        .select("projection_id, master_id")
        .in("master_id", muralIds)
        .eq("projection_type", "experiential")
    : { data: [] };
  const muralProjectionIds = (muralProjections ?? []).map((row) => row.projection_id);
  const { data: muralBindings } = muralProjectionIds.length
    ? await svc
        .from("projection_media_binding")
        .select("projection_id, asset_id, media_asset(storage_ref, provider)")
        .in("projection_id", muralProjectionIds)
        .eq("access_level", "public")
        .eq("binding_type", "primary")
    : { data: [] };

  const curatedUniverseIds = new Set<string>();
  const muralVisualByUniverse = new Map<string, { playback_id: string; provider: string | null }>();
  for (const mural of muralChildren ?? []) {
    const projection = (muralProjections ?? []).find((item) => item.master_id === mural.master_id);
    const binding = projection
      ? (muralBindings ?? []).find((item) => item.projection_id === projection.projection_id)
      : null;
    const storageRef = binding ? mediaStorageRef(binding) : null;
    if (!isPlayableStorageRef(storageRef) || !mural.parent_master_id) continue;
    curatedUniverseIds.add(mural.parent_master_id);
    if (!muralVisualByUniverse.has(mural.parent_master_id) && storageRef) {
      muralVisualByUniverse.set(mural.parent_master_id, {
        playback_id: storageRef,
        provider: binding ? mediaProvider(binding) : null,
      });
    }
  }

  const stateIds = masters.map((m) => m.current_state_id);
  const masterIds = masters.map((m) => m.master_id);
  const attrIds = masters.map((m) => m.attribution_ref).filter(Boolean);

  // Fetch states, projections, attribution, and presentation in parallel
  const [{ data: states }, { data: projections }, { data: attrEntries }, { data: presentationRows }] =
    await Promise.all([
      svc
        .from("canonical_state")
        .select("canonical_state_id, version, authorisation_state")
        .in("canonical_state_id", stateIds)
        .eq("authorisation_state", "authorised"),
      svc
        .from("projection")
        .select("projection_id, canonical_state_id, master_id, projection_type, collectible_designated")
        .in("master_id", masterIds),
      attrIds.length
        ? svc
            .from("attribution_entry")
            .select("attribution_id, role_type")
            .in("attribution_id", attrIds)
            .eq("public", true)
        : Promise.resolve({ data: [] }),
      svc
        .from("work_presentation")
        .select("master_id, title, description")
        .in("master_id", masterIds),
    ]);

  // Now we have projection IDs — use them to query bindings correctly
  const projectionIds = (projections ?? []).map((p) => p.projection_id);

  const [{ data: projPresentations }, { data: bindings }] = await Promise.all([
    projectionIds.length
      ? svc.from("projection_presentation").select("projection_id, title").in("projection_id", projectionIds)
      : Promise.resolve({ data: [] }),
    projectionIds.length
        ? svc
          .from("projection_media_binding")
          .select("projection_id, asset_id, media_asset(storage_ref, provider)")
          .in("projection_id", projectionIds)
          .eq("access_level", "public")
      : Promise.resolve({ data: [] }),
  ]);

  // Determine which asset_ids are placeholders
  const assetIds = (bindings ?? []).map((b) => b.asset_id);
  const { data: assets } = assetIds.length
    ? await svc.from("media_asset").select("asset_id, storage_ref").in("asset_id", assetIds)
    : { data: [] };

  const placeholderSet = new Set(
    (assets ?? []).filter((a) => a.storage_ref?.startsWith("seed:placeholder:")).map((a) => a.asset_id)
  );

  const projHasMedia = new Map<string, boolean>();
  for (const b of bindings ?? []) {
    if (!projHasMedia.has(b.projection_id)) {
      projHasMedia.set(b.projection_id, !placeholderSet.has(b.asset_id));
    }
  }

  return masters
    .map((m) => {
      const cs = (states ?? []).find((s) => s.canonical_state_id === m.current_state_id);
      if (!cs) return null;
      if (m.canonical_type !== "universe" || !curatedUniverseIds.has(m.master_id)) return null;

      const mProjs = (projections ?? []).filter((p) => p.master_id === m.master_id);
      const roles = (attrEntries ?? [])
        .filter((e) => e.attribution_id === m.attribution_ref)
        .map((e) => e.role_type);

      const muralVisual = muralVisualByUniverse.get(m.master_id);
      const visualBinding = (bindings ?? []).map(binding => ({ binding, storageRef: mediaStorageRef(binding) })).find(({ binding, storageRef }) => binding.projection_id === mProjs[0]?.projection_id && !!storageRef && !storageRef.startsWith("seed:placeholder:"));
      const visualPlaybackId = muralVisual?.playback_id ?? visualBinding?.storageRef ?? null;
      const visualProvider = muralVisual?.provider ?? (visualBinding ? mediaProvider(visualBinding.binding) : null);
      const presentation = (presentationRows ?? []).find((p) => p.master_id === m.master_id);

      return {
        master_id: m.master_id,
        canonical_type: m.canonical_type,
        canonical_state_version: cs.version,
        authorisation_state: cs.authorisation_state,
        has_media: true,
        title: presentation?.title ?? null,
        description: presentation?.description ?? null,
        attribution_roles: roles,
        projections: mProjs.map((p) => ({
          projection_id: p.projection_id,
          projection_type: p.projection_type,
          collectible_designated: p.collectible_designated,
          has_media: projHasMedia.get(p.projection_id) ?? false,
          title: (projPresentations ?? []).find((pp) => pp.projection_id === p.projection_id)?.title ?? null,
          visual_playback_id: (bindings ?? []).map(binding => ({ binding, storageRef: mediaStorageRef(binding) })).find(({ binding, storageRef }) => binding.projection_id === p.projection_id && !!storageRef && !storageRef.startsWith("seed:placeholder:"))?.storageRef ?? null,
        })),
        visual_playback_id: visualPlaybackId,
        visual_provider: visualProvider,
      };
    })
    .filter((w): w is DiscoveryUniverse => w !== null);
}

import { getServiceClient } from "@/lib/authority/validate";

export type DiscoveryWorld = {
  master_id: string;
  canonical_type: string;
  canonical_state_version: number;
  authorisation_state: string;
  has_media: boolean;
  attribution_roles: string[];
  projections: DiscoveryProjection[];
};

export type DiscoveryProjection = {
  projection_id: string;
  projection_type: string;
  collectible_designated: boolean;
  has_media: boolean;
};

export async function getDiscovery(): Promise<DiscoveryWorld[]> {
  const svc = getServiceClient();

  // Masters with an authorised current state
  const { data: masters } = await svc
    .from("master")
    .select("master_id, canonical_type, current_state_id, attribution_ref")
    .not("current_state_id", "is", null)
    .order("created_at", { ascending: false });

  if (!masters?.length) return [];

  const stateIds = masters.map((m) => m.current_state_id);
  const masterIds = masters.map((m) => m.master_id);
  const attrIds = masters.map((m) => m.attribution_ref).filter(Boolean);

  const [{ data: states }, { data: projections }, { data: attrEntries }, { data: bindings }] =
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
        .from("projection_media_binding")
        .select("projection_id, access_level, asset_id")
        .in("master_id", masterIds)
        .eq("access_level", "public"),
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

      const mProjs = (projections ?? []).filter((p) => p.master_id === m.master_id);
      const roles = (attrEntries ?? [])
        .filter((e) => e.attribution_id === m.attribution_ref)
        .map((e) => e.role_type);

      const masterHasMedia = mProjs.some((p) => projHasMedia.get(p.projection_id));

      return {
        master_id: m.master_id,
        canonical_type: m.canonical_type,
        canonical_state_version: cs.version,
        authorisation_state: cs.authorisation_state,
        has_media: masterHasMedia,
        attribution_roles: roles,
        projections: mProjs.map((p) => ({
          projection_id: p.projection_id,
          projection_type: p.projection_type,
          collectible_designated: p.collectible_designated,
          has_media: projHasMedia.get(p.projection_id) ?? false,
        })),
      };
    })
    .filter((w): w is DiscoveryWorld => w !== null);
}

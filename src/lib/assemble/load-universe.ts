import { getServiceClient } from "@/lib/authority/validate";
import { buildUniverseAssembly } from "./build-universe";
import type { UniverseAssembly } from "./types";

/**
 * Load the canonical Universe assembly. Callers apply auth; this function
 * only reads live master / presentation / scene_moment relationships.
 */
export async function loadUniverseAssembly(masterId: string): Promise<UniverseAssembly | null> {
  const svc = getServiceClient();

  const { data: master } = await svc
    .from("master")
    .select("master_id, canonical_type, created_at")
    .eq("master_id", masterId)
    .maybeSingle();

  if (!master || master.canonical_type !== "universe") return null;

  const { data: presentation } = await svc
    .from("work_presentation")
    .select("title, description")
    .eq("master_id", masterId)
    .maybeSingle();

  const { data: children } = await svc
    .from("master")
    .select("master_id, canonical_type, parent_master_id, sort_order, created_at")
    .eq("parent_master_id", masterId)
    .order("created_at", { ascending: true });

  const muralMasters = (children ?? []).filter((child) => child.canonical_type === "mural");
  const momentMasters = (children ?? []).filter((child) => child.canonical_type === "creative-moment");
  const muralIds = muralMasters.map((mural) => mural.master_id);
  const momentIds = momentMasters.map((moment) => moment.master_id);

  const { data: sceneMasters } = muralIds.length
    ? await svc
        .from("master")
        .select("master_id, parent_master_id, sort_order, created_at")
        .eq("canonical_type", "scene")
        .in("parent_master_id", muralIds)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
    : { data: [] as { master_id: string; parent_master_id: string | null; sort_order: number | null }[] };

  const sceneIds = (sceneMasters ?? []).map((scene) => scene.master_id);
  const presentationIds = [...muralIds, ...momentIds, ...sceneIds];

  const [{ data: presentations }, { data: sceneProjections }, { data: muralProjections }, { data: momentProjections }, { data: relations }] =
    await Promise.all([
      presentationIds.length
        ? svc.from("work_presentation").select("master_id, title, description").in("master_id", presentationIds)
        : Promise.resolve({ data: [] }),
      sceneIds.length
        ? svc.from("projection").select("projection_id, master_id").in("master_id", sceneIds)
        : Promise.resolve({ data: [] }),
      muralIds.length
        ? svc.from("projection").select("projection_id, master_id").in("master_id", muralIds).eq("projection_type", "experiential")
        : Promise.resolve({ data: [] }),
      momentIds.length
        ? svc.from("projection").select("projection_id, master_id").in("master_id", momentIds)
        : Promise.resolve({ data: [] }),
      sceneIds.length
        ? svc
            .from("scene_moment")
            .select("scene_master_id, moment_master_id, relationship_type, sort_order")
            .in("scene_master_id", sceneIds)
            .eq("relationship_type", "primary")
            .order("sort_order", { ascending: true, nullsFirst: false })
        : Promise.resolve({ data: [] }),
    ]);

  const projIds = [
    ...new Set([
      ...(sceneProjections ?? []).map((projection) => projection.projection_id),
      ...(muralProjections ?? []).map((projection) => projection.projection_id),
    ]),
  ];
  const { data: bindings } = projIds.length
    ? await svc
        .from("projection_media_binding")
        .select("binding_id, projection_id, start_ms, end_ms, asset_id")
        .in("projection_id", projIds)
        .eq("binding_type", "primary")
    : { data: [] };

  const assetIds = [...new Set((bindings ?? []).map((binding) => binding.asset_id).filter(Boolean) as string[])];
  const { data: assets } = assetIds.length
    ? await svc.from("media_asset").select("asset_id, provider, storage_ref").in("asset_id", assetIds)
    : { data: [] };

  return buildUniverseAssembly({
    master: { master_id: master.master_id, created_at: master.created_at },
    presentation: presentation ?? null,
    muralMasters,
    momentMasters,
    sceneMasters: sceneMasters ?? [],
    presentations: presentations ?? [],
    sceneProjections: sceneProjections ?? [],
    muralProjections: muralProjections ?? [],
    momentProjections: momentProjections ?? [],
    bindings: bindings ?? [],
    assets: assets ?? [],
    relations: relations ?? [],
  });
}

export async function loadUniverseProjectCards() {
  const svc = getServiceClient();
  const { data: masters } = await svc
    .from("master")
    .select("master_id, created_at")
    .eq("canonical_type", "universe")
    .order("created_at", { ascending: false });
  if (!masters?.length) return [];
  const ids = masters.map((row) => row.master_id);
  const { data: presentations } = await svc
    .from("work_presentation")
    .select("master_id, title, description")
    .in("master_id", ids);
  return masters.map((row) => {
    const presentation = (presentations ?? []).find((item) => item.master_id === row.master_id);
    return {
      master_id: row.master_id,
      title: presentation?.title ?? "Untitled universe",
      description: presentation?.description ?? null,
    };
  });
}

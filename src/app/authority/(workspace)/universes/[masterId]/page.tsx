export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import UniverseCurationWorkspace, {
  type UniverseCurationData,
  type UniverseCurationMural,
  type UniverseCurationMoment,
  type UniverseCurationScene,
} from "./universe-curation-workspace";

async function loadUniverseCuration(masterId: string): Promise<UniverseCurationData | null> {
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
    : { data: [] as { master_id: string; parent_master_id: string | null; sort_order: number | null; created_at: string }[] };

  const sceneIds = (sceneMasters ?? []).map((scene) => scene.master_id);
  const presentationIds = [...muralIds, ...momentIds, ...sceneIds];

  const [{ data: presentations }, { data: sceneProjections }, { data: momentProjections }, { data: relations }] =
    await Promise.all([
      presentationIds.length
        ? svc.from("work_presentation").select("master_id, title").in("master_id", presentationIds)
        : Promise.resolve({ data: [] }),
      sceneIds.length
        ? svc.from("projection").select("projection_id, master_id").in("master_id", sceneIds)
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

  const titleFor = (id: string) => (presentations ?? []).find((row) => row.master_id === id)?.title ?? null;
  const sceneProjIds = (sceneProjections ?? []).map((projection) => projection.projection_id);
  const { data: bindings } = sceneProjIds.length
    ? await svc
        .from("projection_media_binding")
        .select("projection_id, start_ms, end_ms")
        .in("projection_id", sceneProjIds)
        .eq("binding_type", "primary")
    : { data: [] };

  const primaryMomentByScene = new Map<string, string>();
  for (const relation of relations ?? []) {
    if (!primaryMomentByScene.has(relation.scene_master_id)) {
      primaryMomentByScene.set(relation.scene_master_id, relation.moment_master_id);
    }
  }

  const scenesByMural = new Map<string, UniverseCurationScene[]>();
  for (const scene of sceneMasters ?? []) {
    const muralId = scene.parent_master_id;
    if (!muralId) continue;
    const projection = (sceneProjections ?? []).find((row) => row.master_id === scene.master_id);
    const binding = projection
      ? (bindings ?? []).find((row) => row.projection_id === projection.projection_id)
      : null;
    const creativeMomentId = primaryMomentByScene.get(scene.master_id) ?? null;
    const entry: UniverseCurationScene = {
      master_id: scene.master_id,
      title: titleFor(scene.master_id),
      sort_order: scene.sort_order ?? null,
      start_ms: binding?.start_ms ?? null,
      end_ms: binding?.end_ms ?? null,
      projection_id: projection?.projection_id ?? null,
      creative_moment_id: creativeMomentId,
      creative_moment_title: creativeMomentId ? titleFor(creativeMomentId) : null,
    };
    const list = scenesByMural.get(muralId) ?? [];
    list.push(entry);
    scenesByMural.set(muralId, list);
  }

  const murals: UniverseCurationMural[] = muralMasters.map((mural) => ({
    master_id: mural.master_id,
    title: titleFor(mural.master_id),
    scenes: scenesByMural.get(mural.master_id) ?? [],
  }));

  const scenesForMoment = (momentId: string) =>
    (sceneMasters ?? [])
      .filter((scene) => primaryMomentByScene.get(scene.master_id) === momentId)
      .map((scene) => titleFor(scene.master_id) ?? "Untitled scene");

  const creative_moments: UniverseCurationMoment[] = momentMasters.map((moment) => ({
    master_id: moment.master_id,
    title: titleFor(moment.master_id),
    has_experience: (momentProjections ?? []).some((row) => row.master_id === moment.master_id),
    scene_titles: scenesForMoment(moment.master_id),
  }));

  return {
    master_id: master.master_id,
    title: presentation?.title ?? null,
    description: presentation?.description ?? null,
    created_at: master.created_at,
    murals,
    creative_moments,
  };
}

export default async function UniverseCurationPage({
  params,
}: {
  params: Promise<{ masterId: string }>;
}) {
  const { masterId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const data = await loadUniverseCuration(masterId);
  if (!data) notFound();

  return <UniverseCurationWorkspace data={data} />;
}

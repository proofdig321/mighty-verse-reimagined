import { getServiceClient } from "@/lib/authority/validate";
import {
  classifyUniverseOccupancy,
  hasSourceMediaFromSession,
  type UniverseOccupancy,
} from "./occupancy";
import { isProtectedMaster } from "./protected-work";
import { parsePage, pageMeta, type PageMeta } from "@/lib/pagination";

export type UniverseCatalogueRow = {
  master_id: string;
  title: string | null;
  description: string | null;
  muralCount: number;
  momentCount: number;
  occupancy: UniverseOccupancy;
  withdrawable: boolean;
};

export type UniverseCatalogueResult = {
  rows: UniverseCatalogueRow[];
  pagination: PageMeta;
};

export async function loadUniverseCatalogue(
  pageParam?: string | null,
  pageSizeParam?: string | null,
): Promise<UniverseCatalogueResult> {
  const svc = getServiceClient();
  const pg = parsePage(pageParam, pageSizeParam);

  const { data: masters, count } = await svc
    .from("master")
    .select("master_id, canonical_type, current_state_id, created_at", { count: "exact" })
    .eq("canonical_type", "universe")
    .order("created_at", { ascending: false })
    .range(pg.from, pg.to);

  if (!masters?.length) return { rows: [], pagination: pageMeta(pg, count ?? 0) };

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

  const rows = masters
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

  return { rows, pagination: pageMeta(pg, count ?? 0) };
}

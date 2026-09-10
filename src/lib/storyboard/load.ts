import { getServiceClient } from "../authority/validate";
import { muxThumbnailUrl } from "../media/thumbnail";
import {
  parseStoryboardArtifact,
  parseStoryboardBody,
  type StoryboardArtifactProvenance,
  type StoryboardBodyProvenance,
} from "./artifact";

export type LoadedStoryboardBody = StoryboardBodyProvenance & {
  intake_id: string;
};

export type LoadedStoryboardArtifact = StoryboardArtifactProvenance & {
  intake_id: string;
  asset_id: string | null;
  endpoint_ref: string | null;
};

export async function loadStoryboardMaterials(universeId: string): Promise<{
  body: LoadedStoryboardBody | null;
  artifacts: LoadedStoryboardArtifact[];
}> {
  const svc = getServiceClient();
  const { data: intakes } = await svc
    .from("media_intake")
    .select("intake_id, asset_id, title, provenance_notes")
    .eq("master_id", universeId)
    .order("updated_at", { ascending: false });

  let body: LoadedStoryboardBody | null = null;
  const artifacts: LoadedStoryboardArtifact[] = [];
  const assetIds = [...new Set((intakes ?? []).map((row) => row.asset_id).filter(Boolean) as string[])];
  const { data: variants } = assetIds.length
    ? await svc.from("delivery_variant").select("asset_id, endpoint_ref").in("asset_id", assetIds)
    : { data: [] as { asset_id: string; endpoint_ref: string }[] };
  const endpointByAsset = new Map((variants ?? []).map((row) => [row.asset_id, row.endpoint_ref]));

  for (const row of intakes ?? []) {
    const parsedBody = parseStoryboardBody(row.provenance_notes);
    if (parsedBody && !body) {
      body = { ...parsedBody, intake_id: row.intake_id };
      continue;
    }
    const artifact = parseStoryboardArtifact(row.provenance_notes);
    if (!artifact) continue;
    artifacts.push({
      ...artifact,
      intake_id: row.intake_id,
      asset_id: row.asset_id ?? null,
      endpoint_ref: row.asset_id ? endpointByAsset.get(row.asset_id) ?? null : null,
      still_url:
        artifact.still_url ??
        (artifact.playback_id ? muxThumbnailUrl(artifact.playback_id, 0, 640) : null),
    });
  }

  return { body, artifacts };
}

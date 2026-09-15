/**
 * Gallery reuse — pick already-ingested source media instead of uploading again.
 * Binding still goes through POST /api/authority/media. Occupied Murals stay rejected.
 */

import { mediaAssociationEligibility } from "./association";
import type { CurateStudioMedia } from "./studio";
import { isDiscardedStorageRef } from "../media/discard-asset";

export type GallerySource = {
  asset_id: string;
  title: string | null;
  provider: string | null;
  storage_ref: string;
  duration_ms: number | null;
  readiness_overall: CurateStudioMedia["readiness_overall"];
  associated_title: string | null;
};

export function playableGallerySources(media: CurateStudioMedia[]): GallerySource[] {
  return media
    .filter((item) => {
      if (item.storage_ref.startsWith("seed:placeholder:")) return false;
      if (isDiscardedStorageRef(item.storage_ref)) return false;
      const eligibility = mediaAssociationEligibility({
        readiness_overall: item.readiness_overall,
        readiness_blockers: item.readiness_blockers,
      });
      return eligibility.eligible;
    })
    .map((item) => ({
      asset_id: item.asset_id,
      title: item.title,
      provider: item.provider,
      storage_ref: item.storage_ref,
      duration_ms: item.duration_ms,
      readiness_overall: item.readiness_overall,
      associated_title: item.association.universe_title,
    }));
}

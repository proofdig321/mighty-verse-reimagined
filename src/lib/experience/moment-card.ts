/**
 * Shared Creative Moment card contract for Universe, Experience, and catalog.
 * A card is a projection of an existing Creative Moment. It does not create one.
 */

import { providerThumbnailUrl } from "../media/thumbnail";
import { sceneStillUrl } from "../assemble/composition";

export type MomentCardStillSource = {
  provider: string | null | undefined;
  storage_ref: string | null | undefined;
  start_ms: number | null | undefined;
};

export function momentCardStillUrl(source: MomentCardStillSource | null | undefined, width = 720): string | null {
  if (!source) return null;
  const still = sceneStillUrl({
    provider: source.provider,
    storage_ref: source.storage_ref,
    start_ms: source.start_ms,
  });
  if (!still) return null;
  return providerThumbnailUrl(still.provider, still.storage_ref, {
    timeSec: still.timeSec,
    width,
  });
}

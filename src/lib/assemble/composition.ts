/**
 * Creative Suite composition helpers.
 *
 * Face-up Studio language: numbering, short names, and shared
 * Creative Moment relationships. Does not invent canonical objects.
 */

export function sceneOrdinal(index: number): string {
  return String(index + 1).padStart(2, "0");
}

/**
 * Scene titles are often "Contributor — Short name".
 * Studio objects lead with the cinematic name; the full title remains visible.
 */
export function sceneShortTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  const parts = title.split("—");
  if (parts.length < 2) return title.trim();
  const shortName = parts[parts.length - 1]?.trim();
  return shortName || title.trim();
}

export function sharedCreativeMomentIds(
  scenes: { creative_moment_id: string | null }[],
): Set<string> {
  const counts = new Map<string, number>();
  for (const scene of scenes) {
    if (!scene.creative_moment_id) continue;
    counts.set(scene.creative_moment_id, (counts.get(scene.creative_moment_id) ?? 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id));
}

export function sceneStillUrl(input: {
  provider: string | null | undefined;
  storage_ref: string | null | undefined;
  start_ms: number | null | undefined;
}): { provider: string; storage_ref: string; timeSec: number } | null {
  const storage = input.storage_ref?.trim();
  if (!storage || storage.startsWith("seed:placeholder:")) return null;
  const timeSec = input.start_ms != null && input.start_ms >= 0 ? Math.floor(input.start_ms / 1000) : 0;
  return {
    provider: input.provider ?? "unknown",
    storage_ref: storage,
    timeSec,
  };
}

/**
 * Universe identity is title + description on work_presentation.
 * Artwork, editorial Markdown, and publishing stay on other surfaces.
 */

export type UniverseIdentity = {
  title: string;
  description: string | null;
};

export type UniverseIdentityFields = {
  title?: unknown;
  description?: unknown;
};

export type UniverseIdentityResult =
  | { ok: true; value: UniverseIdentity }
  | { ok: false; error: string };

export function validateUniverseIdentity(input: UniverseIdentityFields): UniverseIdentityResult {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) return { ok: false, error: "Title is required." };

  const description = typeof input.description === "string" ? input.description.trim() : "";
  return { ok: true, value: { title, description: description || null } };
}

export type WorkPresentationRow = {
  title: string;
  description: string | null;
  description_md: string | null;
  artwork_asset_id: string | null;
};

/**
 * Build a work_presentation upsert that always writes identity, and only
 * overwrites editorial Markdown / artwork when those keys are present.
 */
export function mergeWorkPresentationIdentity(
  masterId: string,
  identity: UniverseIdentity,
  existing: WorkPresentationRow | null,
  extras: Record<string, unknown>,
): WorkPresentationRow & { master_id: string; updated_at: string } {
  const hasDescriptionMd = Object.prototype.hasOwnProperty.call(extras, "description_md");
  const hasArtwork = Object.prototype.hasOwnProperty.call(extras, "artwork_asset_id");
  const descriptionMd = typeof extras.description_md === "string" ? extras.description_md.trim() : "";
  const artwork = typeof extras.artwork_asset_id === "string" && extras.artwork_asset_id.trim()
    ? extras.artwork_asset_id.trim()
    : null;

  return {
    master_id: masterId,
    title: identity.title,
    description: identity.description,
    description_md: hasDescriptionMd ? (descriptionMd || null) : (existing?.description_md ?? null),
    artwork_asset_id: hasArtwork ? artwork : (existing?.artwork_asset_id ?? null),
    updated_at: new Date().toISOString(),
  };
}

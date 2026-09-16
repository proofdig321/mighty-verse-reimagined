import { getServiceClient, validateAuthority } from "@/lib/authority/validate";
import { muxAdapter } from "@/lib/media/providers/mux/adapter";
import { muxUploadCorsOrigin } from "@/lib/media/providers/mux/cors-origin";
import { DEFAULT_PROVIDER } from "@/lib/media/providers";
import { isExcludedIntake } from "@/lib/media/discard-asset";
import { decideUrlIngestIntake, defaultUrlIngestWorkType } from "@/lib/media/gallery-intake";
import { decideMuxUrlIngestMethod } from "@/lib/media/url-ingest-method";
import { YoutubeFileError, materializeYoutubeFile } from "@/lib/media/youtube-file";
import {
  parseMediaSourceUrl,
  resolveUrlIngestTitle,
  youtubeVideoIdFromUrl,
} from "@/lib/media/source-url";

export type MuxUrlIngestInput = {
  url: string;
  name?: string;
  participantId: string;
  projectionId?: string | null;
  masterId?: string | null;
  intakeId?: string | null;
  youtubeCookies?: string | null;
};

export type MuxUrlIngestResult =
  | { ok: true; session_id: string; provider_asset_id: string }
  | { ok: false; error: string; status: number };

export type UrlIngestIntakeResult =
  | { ok: true; intake_id: string }
  | { ok: false; error: string; status: number };

/**
 * Every Mux URL pull gets a Gallery intake so the finished asset is titled,
 * not an Untitled orphan. Reuses an unlinked duplicate of the same source URL.
 */
export async function ensureUrlIngestIntake(input: {
  participantId: string;
  url: string;
  name?: string;
  intakeId?: string | null;
  workType?: string;
}): Promise<UrlIngestIntakeResult> {
  const parsed = parseMediaSourceUrl(input.url);
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 };

  const svc = getServiceClient();
  const requested = input.intakeId?.trim() || null;
  const videoId = youtubeVideoIdFromUrl(parsed.url);

  if (requested) {
    const { data: existing } = await svc
      .from("media_intake")
      .select("intake_id, search_status")
      .eq("intake_id", requested)
      .maybeSingle();
    if (!existing) return { ok: false, error: "Media intake record not found", status: 404 };
    if (isExcludedIntake(existing.search_status)) {
      return { ok: false, error: "This intake is already removed from Gallery.", status: 409 };
    }
    return { ok: true, intake_id: existing.intake_id };
  }

  let matchingId: string | null = null;
  const { data: matchingRows } = await svc
    .from("media_intake")
    .select("intake_id")
    .is("asset_id", null)
    .neq("search_status", "excluded")
    .eq("source_url", parsed.url)
    .order("created_at", { ascending: false })
    .limit(1);
  matchingId = matchingRows?.[0]?.intake_id ?? null;
  if (!matchingId && videoId) {
    const { data: byExternal } = await svc
      .from("media_intake")
      .select("intake_id")
      .is("asset_id", null)
      .neq("search_status", "excluded")
      .eq("external_identifier", videoId)
      .order("created_at", { ascending: false })
      .limit(1);
    matchingId = byExternal?.[0]?.intake_id ?? null;
  }

  const decided = decideUrlIngestIntake({
    requestedIntakeId: requested,
    matchingUnlinkedIntakeId: matchingId,
  });
  if (decided.mode !== "create") return { ok: true, intake_id: decided.intakeId };

  const title = await resolveUrlIngestTitle(parsed.url, input.name ?? "YouTube ingest");
  const workType = input.workType && ["song", "audio", "video", "animation", "other"].includes(input.workType)
    ? input.workType
    : defaultUrlIngestWorkType(parsed.kind);

  const { data: created, error } = await svc
    .from("media_intake")
    .insert({
      title,
      work_type: workType,
      source_type: "external-url",
      source_url: parsed.url,
      source_provider: parsed.kind === "youtube" ? "youtube" : null,
      external_identifier: videoId,
      supplied_by: input.participantId,
      isrc_status: "not-applicable",
      visibility: "draft",
      search_status: "pending",
    })
    .select("intake_id")
    .single();

  if (error || !created) {
    return { ok: false, error: error?.message ?? "Failed to create media intake", status: 500 };
  }
  return { ok: true, intake_id: created.intake_id };
}

async function failSession(sessionId: string): Promise<void> {
  const svc = getServiceClient();
  await svc
    .from("media_upload_session")
    .update({ phase: "failed", updated_at: new Date().toISOString() })
    .eq("session_id", sessionId);
}

/**
 * Ingest a YouTube or direct HTTPS URL into Mux without creating a Universe.
 * YouTube watch pages are fetched as a file then Direct Uploaded.
 * Direct HTTPS media files are pulled by Mux.
 */
export async function beginMuxUrlIngest(input: MuxUrlIngestInput): Promise<MuxUrlIngestResult> {
  const parsed = parseMediaSourceUrl(input.url);
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 };

  if (input.projectionId && input.masterId) {
    const auth = await validateAuthority(input.participantId, "authorise-projection", input.masterId);
    if ("error" in auth) return { ok: false, error: auth.error, status: 403 };
  } else {
    const auth = await validateAuthority(input.participantId, "create-canonical-state", null);
    if ("error" in auth) return { ok: false, error: auth.error, status: 403 };
  }

  const svc = getServiceClient();
  const staleThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  if (input.projectionId && input.masterId) {
    await svc
      .from("media_upload_session")
      .update({ phase: "failed" })
      .eq("master_id", input.masterId)
      .eq("projection_id", input.projectionId)
      .in("phase", ["created", "uploading", "processing"])
      .lt("updated_at", staleThreshold);
  }

  const method = decideMuxUrlIngestMethod(parsed.kind);
  const { data: session, error: sessionError } = await svc
    .from("media_upload_session")
    .insert({
      intake_id: input.intakeId ?? null,
      projection_id: input.projectionId ?? null,
      master_id: input.masterId ?? null,
      provider: DEFAULT_PROVIDER,
      provider_asset_id: "pending",
      provider_upload_url: parsed.url,
      phase: method === "youtube-file" ? "uploading" : "processing",
      created_by: input.participantId,
    })
    .select("session_id")
    .single();

  if (sessionError || !session) {
    return { ok: false, error: "Failed to create ingest session", status: 500 };
  }

  try {
    if (method === "youtube-file") {
      const file = await materializeYoutubeFile({
        url: parsed.url,
        cookies: input.youtubeCookies,
      });
      try {
        const uploaded = await muxAdapter.uploadLocalFile({
          filePath: file.filePath,
          passthrough: session.session_id,
          corsOrigin: muxUploadCorsOrigin(),
          contentType: file.contentType,
        });
        await svc
          .from("media_upload_session")
          .update({
            provider_asset_id: uploaded.providerAssetId,
            provider_upload_id: uploaded.providerUploadId,
            phase: "processing",
            updated_at: new Date().toISOString(),
          })
          .eq("session_id", session.session_id);
        return {
          ok: true,
          session_id: session.session_id,
          provider_asset_id: uploaded.providerAssetId,
        };
      } finally {
        await file.cleanup();
      }
    }

    const asset = await muxAdapter.createAssetFromUrl({
      url: parsed.url,
      passthrough: session.session_id,
    });
    if (!asset.providerAssetId) {
      throw new Error("Mux did not return an asset id");
    }
    await svc
      .from("media_upload_session")
      .update({
        provider_asset_id: asset.providerAssetId,
        phase: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", session.session_id);
    return { ok: true, session_id: session.session_id, provider_asset_id: asset.providerAssetId };
  } catch (err) {
    await failSession(session.session_id);
    if (err instanceof YoutubeFileError) {
      return { ok: false, error: err.message, status: 502 };
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `Mux could not ingest this URL. ${message}`,
      status: 502,
    };
  }
}

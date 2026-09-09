/**
 * Advance a media_upload_session from live Mux state.
 *
 * Polling and reconcile must not depend on Mux webhooks reaching this app.
 * This module creates media_asset + delivery_variant only.
 * It MUST NOT create projection_media_binding, masters, or realizations.
 */
import { getServiceClient } from "@/lib/authority/validate";
import { muxAdapter, mapMuxAsset, type DirectUploadStatus } from "@/lib/media/providers/mux/adapter";
import type { ProviderAsset } from "@/lib/media/providers/interface";
import { decideAdvanceUploadSession } from "./upload-advance-decision";

export {
  decideAdvanceUploadSession,
  type AdvanceDecision,
  type MuxAssetSnapshot,
  type MuxUploadSnapshot,
  type UploadSessionSnapshot,
} from "./upload-advance-decision";

function resolvedAssetId(value: string | null | undefined): string | null {
  if (!value || value === "pending") return null;
  return value;
}

export async function ingestMuxReadySession(input: {
  sessionId: string;
  muxAssetId: string;
  intakeId?: string | null;
  existingAssetId?: string | null;
  providerAsset: ProviderAsset;
}): Promise<{ asset_id: string; already: boolean }> {
  const svc = getServiceClient();

  if (input.existingAssetId) {
    await svc
      .from("media_upload_session")
      .update({
        phase: "ingested",
        asset_id: input.existingAssetId,
        provider_asset_id: input.muxAssetId,
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", input.sessionId)
      .neq("phase", "ingested");
    return { asset_id: input.existingAssetId, already: true };
  }

  const { data: existingAsset } = await svc
    .from("media_asset")
    .select("asset_id")
    .eq("provider", "mux")
    .eq("provider_asset_id", input.muxAssetId)
    .maybeSingle();

  let assetId: string;
  let already = false;

  if (existingAsset) {
    assetId = existingAsset.asset_id;
    already = true;
  } else {
    const playbackSource = muxAdapter.buildPlaybackSource(
      input.providerAsset.playbackId,
      input.providerAsset.mediaClass,
    );

    const { data: newAsset, error: assetError } = await svc
      .from("media_asset")
      .insert({
        asset_type: "original",
        storage_ref: input.providerAsset.playbackId,
        integrity_hash: input.providerAsset.integrityHash,
        format: input.providerAsset.format,
        resolution: input.providerAsset.resolution,
        duration_ms: input.providerAsset.durationMs,
        media_class: input.providerAsset.mediaClass,
        provider: "mux",
        provider_asset_id: input.muxAssetId,
        intake_id: input.intakeId ?? null,
      })
      .select("asset_id")
      .single();

    if (assetError) {
      if (assetError.code === "23505") {
        const { data: raced } = await svc
          .from("media_asset")
          .select("asset_id")
          .eq("provider", "mux")
          .eq("provider_asset_id", input.muxAssetId)
          .maybeSingle();
        if (!raced) throw new Error(`Failed to create media_asset: ${assetError.message}`);
        assetId = raced.asset_id;
        already = true;
      } else {
        throw new Error(`Failed to create media_asset: ${assetError.message}`);
      }
    } else if (!newAsset) {
      throw new Error("Failed to create media_asset");
    } else {
      assetId = newAsset.asset_id;
      const { error: variantError } = await svc.from("delivery_variant").insert({
        asset_id: assetId,
        delivery_format: "hls",
        endpoint_ref: playbackSource.endpoint,
      });
      if (variantError && variantError.code !== "23505") {
        console.error("[upload-advance] delivery_variant insert failed:", variantError.message);
      }
    }
  }

  await svc
    .from("media_upload_session")
    .update({
      phase: "ingested",
      asset_id: assetId,
      provider_asset_id: input.muxAssetId,
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", input.sessionId)
    .neq("phase", "ingested");

  if (input.intakeId) {
    await svc
      .from("media_intake")
      .update({ asset_id: assetId })
      .eq("intake_id", input.intakeId)
      .is("asset_id", null);
  }

  return { asset_id: assetId, already };
}

export type AdvancedSession = {
  session_id: string;
  phase: string;
  provider: string;
  asset_id: string | null;
  updated_at: string;
  outcome: "ingested" | "failed" | "in_progress";
  provider_status: string | null;
  advanced: boolean;
};

/**
 * Read Mux, update session phase, and ingest when the asset is ready.
 * Does not bind media to a projection.
 */
export async function advanceUploadSession(sessionId: string): Promise<AdvancedSession | null> {
  const svc = getServiceClient();
  const { data: session } = await svc
    .from("media_upload_session")
    .select(
      "session_id, phase, provider, provider_upload_id, provider_asset_id, asset_id, intake_id, updated_at",
    )
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!session) return null;

  const base = (overrides: Partial<AdvancedSession> = {}): AdvancedSession => ({
    session_id: session.session_id,
    phase: session.phase,
    provider: session.provider,
    asset_id: session.asset_id ?? null,
    updated_at: session.updated_at,
    outcome:
      session.phase === "ingested" || session.phase === "ready"
        ? "ingested"
        : session.phase === "failed"
          ? "failed"
          : "in_progress",
    provider_status: null,
    advanced: false,
    ...overrides,
  });

  if (session.phase === "ingested" && session.asset_id) {
    return base({ outcome: "ingested" });
  }
  if (session.provider !== "mux") {
    return base();
  }

  let upload: DirectUploadStatus | null = null;
  try {
    if (session.provider_upload_id) {
      upload = await muxAdapter.retrieveDirectUpload(session.provider_upload_id);
    }
  } catch (err) {
    console.error("[upload-advance] Mux upload retrieve failed:", err instanceof Error ? err.message : err);
  }

  const muxAssetId =
    resolvedAssetId(session.provider_asset_id) ?? resolvedAssetId(upload?.assetId ?? null);

  let providerAsset: ProviderAsset | null = null;
  let assetStatus: string | null = null;
  if (muxAssetId) {
    try {
      const mux = (await import("@/lib/media/providers/mux/client")).getMuxClient();
      const raw = await mux.video.assets.retrieve(muxAssetId);
      assetStatus = typeof raw.status === "string" ? raw.status : null;
      providerAsset = mapMuxAsset(raw);
    } catch (err) {
      console.error("[upload-advance] Mux asset retrieve failed:", err instanceof Error ? err.message : err);
      providerAsset = await muxAdapter.getAsset(muxAssetId);
    }
  }

  const decision = decideAdvanceUploadSession({
    session: {
      phase: session.phase,
      provider_asset_id: session.provider_asset_id,
      asset_id: session.asset_id,
      provider_upload_id: session.provider_upload_id,
    },
    upload: upload ? { status: upload.status, assetId: upload.assetId } : null,
    asset: muxAssetId
      ? {
          status: assetStatus ?? (providerAsset?.playbackId ? "ready" : "preparing"),
          playbackId: providerAsset?.playbackId || null,
          providerAssetId: muxAssetId,
        }
      : null,
  });

  const providerStatus = assetStatus ?? upload?.status ?? null;

  if (decision.action === "noop") {
    return base({ provider_status: providerStatus });
  }

  if (decision.action === "fail") {
    await svc
      .from("media_upload_session")
      .update({ phase: "failed", updated_at: new Date().toISOString() })
      .eq("session_id", sessionId)
      .not("phase", "in", '("failed","ingested")');
    return base({
      phase: "failed",
      outcome: "failed",
      provider_status: providerStatus,
      advanced: true,
    });
  }

  if (decision.action === "wait") {
    const patch: Record<string, unknown> = {
      phase: decision.phase,
      updated_at: new Date().toISOString(),
    };
    if (decision.providerAssetId) patch.provider_asset_id = decision.providerAssetId;
    await svc.from("media_upload_session").update(patch).eq("session_id", sessionId).in("phase", [
      "created",
      "uploading",
      "processing",
    ]);
    return base({
      phase: decision.phase,
      outcome: "in_progress",
      provider_status: providerStatus,
      advanced: decision.phase !== session.phase || Boolean(decision.providerAssetId && decision.providerAssetId !== session.provider_asset_id),
    });
  }

  if (!providerAsset?.playbackId) {
    await svc
      .from("media_upload_session")
      .update({
        phase: "processing",
        provider_asset_id: decision.providerAssetId,
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId)
      .in("phase", ["created", "uploading", "processing"]);
    return base({
      phase: "processing",
      outcome: "in_progress",
      provider_status: providerStatus,
      advanced: true,
    });
  }

  const ingested = await ingestMuxReadySession({
    sessionId,
    muxAssetId: decision.providerAssetId,
    intakeId: session.intake_id,
    existingAssetId: session.asset_id,
    providerAsset,
  });

  return base({
    phase: "ingested",
    asset_id: ingested.asset_id,
    outcome: "ingested",
    provider_status: providerStatus,
    advanced: true,
  });
}

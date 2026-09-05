import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/authority/validate";
import { verifyMuxWebhook, mapMuxAsset } from "@/lib/media/providers/mux/adapter";
import { muxAdapter } from "@/lib/media/providers/mux/adapter";

/**
 * POST /api/webhooks/mux
 *
 * Receives Mux lifecycle events and reconciles provider state with
 * Mighty Verse upload sessions and media assets.
 *
 * AUTHORITY BOUNDARY — this handler may create/update:
 *   media_asset          (provider identity + delivery metadata)
 *   delivery_variant     (HLS endpoint)
 *   media_upload_session (phase + provider identity)
 *
 * This handler MUST NOT create:
 *   media_realization
 *   projection_media_binding
 *   ISRC records
 *   canonical creative work
 *   authority records
 *   rights ownership
 *
 * Those are canonical authority operations governed by the existing
 * /api/authority/media and /api/authority/media-realization routes.
 *
 * IDEMPOTENCY — every handler is safe to call multiple times.
 * ORDERING — handlers are safe regardless of event arrival order.
 */

export async function POST(request: Request) {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[mux-webhook] MUX_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Read raw body BEFORE parsing — required for HMAC signature verification
  const rawBody = await request.text();
  const signature = request.headers.get("mux-signature") ?? "";

  // Verify signature — reject anything that doesn't pass
  let payload: MuxWebhookPayload;
  try {
    payload = verifyMuxWebhook(rawBody, signature, secret) as MuxWebhookPayload;
  } catch (err) {
    console.warn("[mux-webhook] Invalid signature:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const { type, data } = payload;
  console.info(`[mux-webhook] event=${type} passthrough=${data?.passthrough ?? "none"} id=${data?.id ?? "none"}`);

  try {
    switch (type) {
      case "video.upload.asset_created":
        await handleUploadAssetCreated(data);
        break;
      case "video.asset.ready":
        await handleAssetReady(data);
        break;
      case "video.asset.errored":
        await handleAssetErrored(data);
        break;
      case "video.asset.deleted":
        await handleAssetDeleted(data);
        break;
      default:
        // Unknown event type — acknowledge without processing
        console.info(`[mux-webhook] Unhandled event type: ${type}`);
    }
  } catch (err) {
    // Return 500 so Mux retries — but log the error
    console.error(`[mux-webhook] Handler error for ${type}:`, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------
// video.upload.asset_created
// Mux has created an asset from the upload. We now know the Mux asset ID.
// ---------------------------------------------------------------------------
async function handleUploadAssetCreated(data: MuxEventData) {
  const passthrough = data.passthrough;
  const muxAssetId = data.asset_id ?? data.id;

  if (!muxAssetId) {
    console.warn("[mux-webhook] asset_created: no asset_id in payload");
    return;
  }

  const svc = getServiceClient();

  // Correlate via passthrough (session_id) — primary key
  // Fall back to provider_upload_id if passthrough is absent
  let query = svc
    .from("media_upload_session")
    .update({
      provider_asset_id: muxAssetId,
      phase: "processing",
      updated_at: new Date().toISOString(),
    })
    .eq("provider", "mux")
    .in("phase", ["created", "uploading", "processing"]);

  if (passthrough) {
    query = query.eq("session_id", passthrough);
  } else if (data.upload_id) {
    query = query.eq("provider_upload_id", data.upload_id);
  } else {
    console.warn("[mux-webhook] asset_created: no passthrough or upload_id for correlation");
    return;
  }

  const { error } = await query;
  if (error) {
    console.error("[mux-webhook] asset_created: session update failed:", error.message);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// video.asset.ready
// The Mux asset is processed and playable. Create canonical provider records.
// This is the authoritative completion event.
// ---------------------------------------------------------------------------
async function handleAssetReady(data: MuxEventData) {
  const passthrough = data.passthrough;
  const muxAssetId = data.id;

  if (!muxAssetId) {
    console.warn("[mux-webhook] asset.ready: no asset id in payload");
    return;
  }

  const svc = getServiceClient();

  // Find the session — primary correlation via passthrough, fallback via provider_asset_id
  let session: UploadSession | null = null;

  if (passthrough) {
    const { data: s } = await svc
      .from("media_upload_session")
      .select("session_id, phase, projection_id, master_id, intake_id, asset_id, provider_asset_id")
      .eq("session_id", passthrough)
      .eq("provider", "mux")
      .maybeSingle();
    session = s ?? null;
  }

  if (!session) {
    // Fallback: correlate by provider_asset_id
    const { data: s } = await svc
      .from("media_upload_session")
      .select("session_id, phase, projection_id, master_id, intake_id, asset_id, provider_asset_id")
      .eq("provider", "mux")
      .eq("provider_asset_id", muxAssetId)
      .maybeSingle();
    session = s ?? null;
  }

  if (!session) {
    // Last resort: server-side Mux fetch to confirm asset exists, then log reconciliation problem
    console.warn(`[mux-webhook] asset.ready: no session found for mux_asset_id=${muxAssetId} passthrough=${passthrough ?? "none"}`);
    const asset = await muxAdapter.getAsset(muxAssetId);
    if (asset) {
      console.warn(`[mux-webhook] asset.ready: Mux asset confirmed (${muxAssetId}) but no Mighty Verse session found. Manual reconciliation required.`);
    }
    return;
  }

  // Idempotency: if already ingested, skip all writes
  if (session.phase === "ingested") {
    console.info(`[mux-webhook] asset.ready: session ${session.session_id} already ingested — skipping`);
    return;
  }

  // If media_asset already exists for this session, skip creation but update phase
  if (session.asset_id) {
    await svc
      .from("media_upload_session")
      .update({ phase: "ingested", updated_at: new Date().toISOString() })
      .eq("session_id", session.session_id)
      .neq("phase", "ingested");
    console.info(`[mux-webhook] asset.ready: asset already exists for session ${session.session_id} — phase updated`);
    return;
  }

  // Map Mux asset payload to normalized ProviderAsset
  const providerAsset = mapMuxAsset(data);
  if (!providerAsset.playbackId) {
    // Payload may lack playback_ids — fetch from Mux
    const fetched = await muxAdapter.getAsset(muxAssetId);
    if (!fetched?.playbackId) {
      console.error(`[mux-webhook] asset.ready: no playback_id for mux_asset_id=${muxAssetId}`);
      throw new Error(`No playback_id for Mux asset ${muxAssetId}`);
    }
    Object.assign(providerAsset, fetched);
  }

  const playbackSource = muxAdapter.buildPlaybackSource(providerAsset.playbackId, providerAsset.mediaClass);

  // Create media_asset — use INSERT with conflict handling on (provider, provider_asset_id)
  // to prevent duplicates under concurrent webhook delivery.
  const { data: asset, error: assetError } = await svc
    .from("media_asset")
    .insert({
      asset_type: "original",
      storage_ref: providerAsset.playbackId,
      integrity_hash: providerAsset.integrityHash,
      format: providerAsset.format,
      resolution: providerAsset.resolution,
      duration_ms: providerAsset.durationMs,
      media_class: providerAsset.mediaClass,
      provider: "mux",
      provider_asset_id: muxAssetId,
      intake_id: session.intake_id ?? null,
    })
    .select("asset_id")
    .single();

  if (assetError) {
    // Check if this is a duplicate (concurrent handler already created it)
    if (assetError.code === "23505") {
      // Unique constraint violation — another handler created it first
      console.info(`[mux-webhook] asset.ready: duplicate asset creation prevented for ${muxAssetId}`);
      // Find the existing asset and update session
      const { data: existing } = await svc
        .from("media_asset")
        .select("asset_id")
        .eq("provider", "mux")
        .eq("provider_asset_id", muxAssetId)
        .maybeSingle();
      if (existing) {
        await svc
          .from("media_upload_session")
          .update({ phase: "ingested", asset_id: existing.asset_id, updated_at: new Date().toISOString() })
          .eq("session_id", session.session_id)
          .neq("phase", "ingested");
      }
      return;
    }
    console.error("[mux-webhook] asset.ready: media_asset insert failed:", assetError.message);
    throw assetError;
  }

  // Create delivery_variant — idempotent via asset_id + delivery_format
  const { error: variantError } = await svc
    .from("delivery_variant")
    .insert({
      asset_id: asset.asset_id,
      delivery_format: "hls",
      endpoint_ref: playbackSource.endpoint,
    });

  if (variantError && variantError.code !== "23505") {
    console.error("[mux-webhook] asset.ready: delivery_variant insert failed:", variantError.message);
    throw variantError;
  }

  // Update session: phase = ingested, asset_id = canonical Mighty Verse UUID
  // Use conditional update to prevent race condition with concurrent handler
  const { error: sessionError } = await svc
    .from("media_upload_session")
    .update({
      phase: "ingested",
      asset_id: asset.asset_id,
      provider_asset_id: muxAssetId,
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", session.session_id)
    .neq("phase", "ingested"); // Only update if not already ingested

  if (sessionError) {
    console.error("[mux-webhook] asset.ready: session update failed:", sessionError.message);
    // Non-fatal — asset and variant were created successfully
  }

  console.info(`[mux-webhook] asset.ready: created asset=${asset.asset_id} for session=${session.session_id} media_class=${providerAsset.mediaClass}`);
}

// ---------------------------------------------------------------------------
// video.asset.errored
// Mux processing failed. Mark session as failed.
// ---------------------------------------------------------------------------
async function handleAssetErrored(data: MuxEventData) {
  const passthrough = data.passthrough;
  const muxAssetId = data.id;
  const svc = getServiceClient();

  let query = svc
    .from("media_upload_session")
    .update({ phase: "failed", updated_at: new Date().toISOString() })
    .eq("provider", "mux")
    .not("phase", "in", '("failed","ingested")');

  if (passthrough) {
    query = query.eq("session_id", passthrough);
  } else if (muxAssetId) {
    query = query.eq("provider_asset_id", muxAssetId);
  } else {
    console.warn("[mux-webhook] asset.errored: no correlation identifier");
    return;
  }

  const { error } = await query;
  if (error) console.error("[mux-webhook] asset.errored: session update failed:", error.message);
}

// ---------------------------------------------------------------------------
// video.asset.deleted
// Mux asset was deleted. Null out the delivery endpoint — canonical records preserved.
// ---------------------------------------------------------------------------
async function handleAssetDeleted(data: MuxEventData) {
  const muxAssetId = data.id;
  if (!muxAssetId) return;

  const svc = getServiceClient();

  // Find the media_asset by provider_asset_id
  const { data: asset } = await svc
    .from("media_asset")
    .select("asset_id")
    .eq("provider", "mux")
    .eq("provider_asset_id", muxAssetId)
    .maybeSingle();

  if (!asset) {
    console.info(`[mux-webhook] asset.deleted: no local asset found for mux_asset_id=${muxAssetId}`);
    return;
  }

  // Null the delivery endpoint — the canonical media_asset record is preserved
  await svc
    .from("delivery_variant")
    .update({ endpoint_ref: null })
    .eq("asset_id", asset.asset_id);

  console.info(`[mux-webhook] asset.deleted: endpoint_ref nulled for asset=${asset.asset_id}`);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MuxEventData = {
  id?: string;
  asset_id?: string;
  upload_id?: string;
  passthrough?: string;
  playback_ids?: Array<{ id: string; policy?: string }>;
  tracks?: Array<{ type?: string; width?: number; height?: number }>;
  duration?: number;
  max_stored_resolution?: string;
  status?: string;
  errors?: unknown;
};

type MuxWebhookPayload = {
  type: string;
  data: MuxEventData;
};

type UploadSession = {
  session_id: string;
  phase: string;
  projection_id: string;
  master_id: string;
  intake_id: string | null;
  asset_id: string | null;
  provider_asset_id: string | null;
};

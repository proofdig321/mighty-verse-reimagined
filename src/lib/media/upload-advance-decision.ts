/**
 * Pure Mux upload-session advance decisions.
 * No I/O. Polling/reconcile apply these against live Mux state.
 */

export type UploadSessionSnapshot = {
  phase: string;
  provider_asset_id: string | null;
  asset_id: string | null;
  provider_upload_id?: string | null;
};

export type MuxUploadSnapshot = {
  status: string;
  assetId: string | null;
};

export type MuxAssetSnapshot = {
  status: string;
  playbackId: string | null;
  providerAssetId: string;
};

export type AdvanceDecision =
  | { action: "noop"; phase: string }
  | { action: "wait"; phase: "uploading" | "processing"; providerAssetId?: string | null }
  | { action: "ingest"; providerAssetId: string }
  | { action: "fail"; reason: string };

function resolvedAssetId(value: string | null | undefined): string | null {
  if (!value || value === "pending") return null;
  return value;
}

export function decideAdvanceUploadSession(input: {
  session: UploadSessionSnapshot;
  upload: MuxUploadSnapshot | null;
  asset: MuxAssetSnapshot | null;
}): AdvanceDecision {
  const session = input.session;
  if (session.phase === "ingested" && session.asset_id) {
    return { action: "noop", phase: "ingested" };
  }

  const uploadStatus = input.upload?.status ?? null;
  if (uploadStatus === "errored" || uploadStatus === "timed_out" || uploadStatus === "cancelled") {
    return { action: "fail", reason: `Mux upload ${uploadStatus}` };
  }

  if (input.asset?.status === "errored") {
    return { action: "fail", reason: "Mux asset processing failed" };
  }

  const muxAssetId =
    resolvedAssetId(input.asset?.providerAssetId) ??
    resolvedAssetId(input.upload?.assetId) ??
    resolvedAssetId(session.provider_asset_id);

  if (input.asset?.status === "ready" && input.asset.playbackId && muxAssetId) {
    return { action: "ingest", providerAssetId: muxAssetId };
  }

  if (
    input.asset?.status === "preparing" ||
    uploadStatus === "asset_created" ||
    (muxAssetId && input.asset?.status !== "ready")
  ) {
    return { action: "wait", phase: "processing", providerAssetId: muxAssetId };
  }

  if (uploadStatus === "waiting" || session.phase === "created" || session.phase === "uploading") {
    return { action: "wait", phase: "uploading", providerAssetId: muxAssetId };
  }

  return { action: "wait", phase: "processing", providerAssetId: muxAssetId };
}

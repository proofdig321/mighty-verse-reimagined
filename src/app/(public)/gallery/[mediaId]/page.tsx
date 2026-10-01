export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ScanSearch, Clapperboard } from "lucide-react";
import { getServiceClient } from "@/lib/authority/validate";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/media/timing";
import { providerThumbnailUrl } from "@/lib/media/thumbnail";
import MediaVisual from "@/components/media-visual";

async function getData(mediaId: string) {
  const svc = getServiceClient();

  const { data: asset } = await svc
    .from("media_asset")
    .select("asset_id, asset_type, storage_ref, provider, duration_ms, width, height, rights_holder_ref, rights_basis, intake_id")
    .eq("asset_id", mediaId)
    .maybeSingle();

  if (!asset) return null;

  const { data: intake } = asset.intake_id
    ? await svc.from("media_intake").select("title, work_type, creator_name, description, genre").eq("intake_id", asset.intake_id).maybeSingle()
    : { data: null };

  // Find any Universe this asset is bound to
  const { data: bindings } = await svc
    .from("projection_media_binding")
    .select("projection_id")
    .eq("asset_id", mediaId)
    .limit(1);

  const projId = bindings?.[0]?.projection_id ?? null;
  const { data: projection } = projId
    ? await svc.from("projection").select("master_id").eq("projection_id", projId).maybeSingle()
    : { data: null };

  const universeId = projection?.master_id ?? null;
  const { data: presentation } = universeId
    ? await svc.from("work_presentation").select("title").eq("master_id", universeId).maybeSingle()
    : { data: null };

  return {
    asset,
    intake,
    universeId,
    universeTitle: presentation?.title ?? null,
  };
}

export default async function GalleryMediaPage({
  params,
}: {
  params: Promise<{ mediaId: string }>;
}) {
  const { mediaId } = await params;
  const data = await getData(mediaId);
  if (!data) notFound();

  const { asset, intake, universeId, universeTitle } = data;
  const title = intake?.title ?? universeTitle ?? "Untitled media";
  const isVideo = asset.asset_type?.toLowerCase().includes("video");
  const thumbnailUrl = isVideo && asset.provider && asset.storage_ref
    ? providerThumbnailUrl(asset.provider, asset.storage_ref, { timeSec: 5, width: 640 })
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav bar */}
      <div className="border-b border-border/50 bg-card/20">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/gallery" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
            <ChevronLeft size={14} />
            Gallery
          </Link>
          <span>/</span>
          <span className="text-foreground truncate">{title}</span>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-10 space-y-10">

        {/* Header */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Source · {asset.asset_type ?? "Media"}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display, inherit)" }}>
            {title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {asset.asset_type && <Badge variant="outline">{asset.asset_type}</Badge>}
            {intake?.work_type && <Badge variant="outline">{intake.work_type}</Badge>}
            {asset.duration_ms && <Badge variant="outline">{formatDuration(asset.duration_ms / 1000)}</Badge>}
            {asset.width && asset.height && <Badge variant="outline">{asset.width}×{asset.height}</Badge>}
            {universeTitle && <Badge variant="secondary">{universeTitle}</Badge>}
          </div>
        </div>

        {/* Media preview */}
        <div className="rounded-xl overflow-hidden border border-border/40">
          {isVideo ? (
            <MediaVisual
              playbackId={asset.storage_ref ?? undefined}
              provider={asset.provider}
              title={title}
              aspectRatio="16/9"
            />
          ) : thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailUrl} alt={title} className="w-full aspect-video object-cover" />
          ) : (
            <div className="w-full aspect-video bg-card/60 flex items-center justify-center">
              <p className="text-sm text-muted-foreground/40">No preview available</p>
            </div>
          )}
        </div>

        {/* Identity */}
        {(intake?.creator_name || intake?.description || intake?.genre) && (
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Identity</p>
            <div className="rounded-lg border border-border bg-card/50 px-4 py-4 space-y-2">
              {intake.creator_name && (
                <p className="text-sm text-foreground">{intake.creator_name}</p>
              )}
              {intake.description && (
                <p className="text-sm text-muted-foreground">{intake.description}</p>
              )}
              {intake.genre && (
                <p className="text-xs text-muted-foreground">{intake.genre}</p>
              )}
            </div>
          </div>
        )}

        {/* Rights */}
        <div className="rounded-lg border border-border bg-card/50 px-4 py-4 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Rights</p>
          {asset.rights_holder_ref ? (
            <p className="text-sm text-foreground">{asset.rights_basis ?? "Rights recorded"}</p>
          ) : (
            <p className="text-sm text-muted-foreground/60">Rights holder not recorded</p>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Continue</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/studio/work?source=${mediaId}`}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              <Clapperboard size={14} />
              Use in Storyboard
            </Link>
            <Link
              href={`/authority/media/inspect?assetId=${mediaId}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <ScanSearch size={14} />
              Inspect &amp; Sentinel
            </Link>
            {universeId && (
              <Link
                href={`/authority/curate/${universeId}/sentinel`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Open Sentinel
              </Link>
            )}
          </div>
          <p className="text-xs text-muted-foreground/60">
            Selecting this source does not create a Scene or change canonical state.
          </p>
        </div>

      </div>
    </div>
  );
}

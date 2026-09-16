"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sceneOrdinal, sceneShortTitle, sceneStillUrl, sceneCreativeMomentIds } from "@/lib/assemble/composition";
import { providerThumbnailUrl } from "@/lib/media/thumbnail";
import { formatTimelineMs } from "@/lib/media/timing";
import type { PresenceOption } from "@/lib/assemble/presence";
import type { SuiteScene } from "@/lib/assemble/suite";
import { cn } from "@/lib/utils";
import { CreativeStill } from "./creative-still";
import { SceneIdentity } from "./scene-identity-authoring";
import { SceneArtwork } from "./scene-artwork-authoring";
import { SceneOrder, applySceneMove } from "./scene-order-authoring";
import { SceneTiming } from "./scene-timing-authoring";
import { ScenePresence } from "./presence-authoring";

type ScenePanel = "identity" | "still" | "timing" | "presence" | "details" | null;

export function SceneObject({
  scene,
  index,
  sharedIds,
  candidates,
  muralSceneIds,
  universeId,
  canAuthorPresence,
  canAuthorIdentity,
  canAuthorTiming,
  canAuthorOrder,
  openHref,
  openLabel,
  workspaceHref,
  compact = false,
}: {
  scene: SuiteScene;
  index: number;
  sharedIds: string[];
  candidates: PresenceOption[];
  muralSceneIds: string[];
  universeId: string;
  canAuthorPresence: boolean;
  canAuthorIdentity: boolean;
  canAuthorTiming: boolean;
  canAuthorOrder: boolean;
  openHref: string;
  openLabel: string;
  workspaceHref?: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<ScenePanel>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const ordinal = scene.sort_order != null ? String(scene.sort_order).padStart(2, "0") : sceneOrdinal(index);
  const shortTitle = sceneShortTitle(scene.title) ?? "Untitled scene";
  const fullTitle = scene.title?.trim() || null;
  const showFullTitle = fullTitle && fullTitle !== shortTitle;
  const still = sceneStillUrl(scene);
  const stillUrl = still
    ? providerThumbnailUrl(still.provider, still.storage_ref, { timeSec: still.timeSec, width: compact ? 320 : 640 })
    : null;
  const timing =
    scene.start_ms != null && scene.end_ms != null
      ? `${formatTimelineMs(scene.start_ms)} → ${formatTimelineMs(scene.end_ms)}`
      : null;
  const headingId = `universe-scene-heading-${scene.master_id}`;
  const related = (scene.creative_moments?.length
    ? scene.creative_moments
    : scene.creative_moment_id
      ? [{ master_id: scene.creative_moment_id, title: scene.creative_moment_title }]
      : []) satisfies PresenceOption[];
  const momentCount = related.length;
  const momentStatus = momentCount > 0 ? `Creative Moment · ${momentCount}` : "No Creative Moment";
  const orderIndex = muralSceneIds.indexOf(scene.master_id);
  const canEarlier = canAuthorOrder && orderIndex > 0;
  const canLater = canAuthorOrder && orderIndex >= 0 && orderIndex < muralSceneIds.length - 1;

  async function move(direction: "earlier" | "later") {
    setMoveError(null);
    setMoveBusy(true);
    try {
      await applySceneMove({
        universeId,
        muralId: scene.mural_id,
        sceneId: scene.master_id,
        orderedSceneIds: muralSceneIds,
        direction,
      });
      router.refresh();
    } catch (caught) {
      setMoveError(caught instanceof Error ? caught.message : "Scene order could not be saved.");
    } finally {
      setMoveBusy(false);
    }
  }

  const actionsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "outline", size: compact ? "icon-sm" : "sm" }))}
        aria-label={`Scene actions for ${shortTitle}`}
        disabled={moveBusy}
      >
        {compact ? <MoreHorizontal /> : "Actions"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom">
        {canAuthorIdentity ? (
          <>
            <DropdownMenuItem onClick={() => setPanel("identity")}>Edit identity</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPanel("still")}>Edit still</DropdownMenuItem>
          </>
        ) : null}
        {canAuthorTiming ? (
          <DropdownMenuItem onClick={() => setPanel("timing")}>Edit timing</DropdownMenuItem>
        ) : null}
        {canAuthorOrder ? (
          <>
            <DropdownMenuItem disabled={!canEarlier || moveBusy} onClick={() => void move("earlier")}>
              Move earlier
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canLater || moveBusy} onClick={() => void move("later")}>
              Move later
            </DropdownMenuItem>
          </>
        ) : null}
        {canAuthorPresence ? (
          <DropdownMenuItem onClick={() => setPanel("presence")}>Add presence</DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={() => setPanel("details")}>Details</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLinkItem href={openHref} closeOnClick>
          {openLabel}
        </DropdownMenuLinkItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const panelBody = (
    <>
      {panel === "identity" ? (
        <SceneIdentity
          universeId={universeId}
          sceneId={scene.master_id}
          sceneLabel={shortTitle}
          title={fullTitle ?? ""}
          description={scene.description ?? ""}
          muralId={scene.mural_id}
          canAuthor={canAuthorIdentity}
          startOpen
          hideTrigger
        />
      ) : null}
      {panel === "still" ? (
        <SceneArtwork
          universeId={universeId}
          sceneId={scene.master_id}
          sceneLabel={shortTitle}
          muralId={scene.mural_id}
          projectionId={scene.projection_id}
          provider={scene.provider}
          storageRef={scene.storage_ref}
          startMs={scene.start_ms}
          artworkStorageRef={scene.artwork_storage_ref}
          canAuthor={canAuthorIdentity}
          startOpen
          hideTrigger
        />
      ) : null}
      {panel === "timing" ? (
        <SceneTiming
          universeId={universeId}
          sceneId={scene.master_id}
          sceneLabel={shortTitle}
          muralId={scene.mural_id}
          bindingId={scene.binding_id}
          startMs={scene.start_ms}
          endMs={scene.end_ms}
          canAuthor={canAuthorTiming}
          startOpen
          hideTrigger
        />
      ) : null}
      {panel === "presence" ? (
        <ScenePresence
          universeId={universeId}
          sceneId={scene.master_id}
          sceneLabel={shortTitle}
          related={related}
          candidates={candidates}
          sharedIds={sharedIds}
          canAuthor={canAuthorPresence}
          compact={false}
          startOpen
        />
      ) : null}
      {panel === "details" ? (
        <dl className="suite-identifiers">
          <div>
            <dt>Scene</dt>
            <dd className="font-mono text-[11px]">{scene.master_id}</dd>
          </div>
          {scene.projection_id ? (
            <div>
              <dt>Projection</dt>
              <dd className="font-mono text-[11px]">{scene.projection_id}</dd>
            </div>
          ) : null}
          {scene.provider ? (
            <div>
              <dt>Provider</dt>
              <dd>{scene.provider}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {moveError ? (
        <p role="alert" className="text-xs text-destructive">
          {moveError}
        </p>
      ) : null}
    </>
  );

  if (compact) {
    return (
      <article
        id={`universe-scene-${scene.master_id}`}
        className="suite-scene-object is-compact"
        data-scene-id={scene.master_id}
        data-scene-layout="deck"
        data-related-moments={sceneCreativeMomentIds(scene).join(" ") || undefined}
        aria-labelledby={headingId}
      >
        <div className="suite-scene-row">
          <div className="suite-scene-thumb">
            <CreativeStill url={stillUrl} alt="" />
            <p className="suite-scene-ordinal" aria-hidden="true">
              {ordinal}
            </p>
          </div>
          <div className="suite-scene-copy">
            <h3 id={headingId} className="suite-scene-title">
              <span className="sr-only">Scene {ordinal}. </span>
              {shortTitle}
            </h3>
            <p className="suite-scene-timing">
              {timing ?? <span className="italic text-muted-foreground/70">Timing not set</span>}
            </p>
            {showFullTitle ? <p className="suite-scene-full-title">{fullTitle}</p> : null}
            <button
              type="button"
              className="suite-meta-status"
              onClick={() => setPanel((current) => (current === "presence" ? null : "presence"))}
            >
              {momentStatus}
            </button>
          </div>
          <div className="suite-scene-row-actions">
            {workspaceHref ? (
              <Link href={workspaceHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Open
                <span className="sr-only"> Scene {shortTitle}</span>
              </Link>
            ) : null}
            {actionsMenu}
          </div>
        </div>
        {panel || moveError ? <div className="suite-scene-disclosure">{panelBody}</div> : null}
      </article>
    );
  }

  return (
    <article
      id={`universe-scene-${scene.master_id}`}
      className="suite-scene-object is-workspace"
      data-scene-id={scene.master_id}
      data-scene-layout="workspace"
      data-related-moments={sceneCreativeMomentIds(scene).join(" ") || undefined}
      aria-labelledby={headingId}
    >
      <div className="suite-scene-still">
        <CreativeStill url={stillUrl} alt="" />
        <p className="suite-scene-ordinal" aria-hidden="true">
          {ordinal}
        </p>
      </div>
      <div className="suite-scene-body">
        <div className="suite-scene-workspace-head">
          <div className="min-w-0">
            <h3 id={headingId} className="suite-scene-title">
              <span className="sr-only">Scene {ordinal}. </span>
              {shortTitle}
            </h3>
            {showFullTitle ? <p className="suite-scene-full-title">{fullTitle}</p> : null}
            <p className="suite-scene-timing">
              {timing ?? <span className="italic text-muted-foreground/70">Timing not set</span>}
            </p>
          </div>
          <div className="suite-scene-row-actions">
            {actionsMenu}
          </div>
        </div>
        {scene.description?.trim() ? (
          <details className="studio-disclosure">
            <summary>Description</summary>
            <p className="suite-scene-description">{scene.description.trim()}</p>
          </details>
        ) : null}
        <SceneIdentity
          universeId={universeId}
          sceneId={scene.master_id}
          sceneLabel={shortTitle}
          title={fullTitle ?? ""}
          description={scene.description ?? ""}
          muralId={scene.mural_id}
          canAuthor={canAuthorIdentity}
        />
        <SceneArtwork
          universeId={universeId}
          sceneId={scene.master_id}
          sceneLabel={shortTitle}
          muralId={scene.mural_id}
          projectionId={scene.projection_id}
          provider={scene.provider}
          storageRef={scene.storage_ref}
          startMs={scene.start_ms}
          artworkStorageRef={scene.artwork_storage_ref}
          canAuthor={canAuthorIdentity}
        />
        <SceneTiming
          universeId={universeId}
          sceneId={scene.master_id}
          sceneLabel={shortTitle}
          muralId={scene.mural_id}
          bindingId={scene.binding_id}
          startMs={scene.start_ms}
          endMs={scene.end_ms}
          canAuthor={canAuthorTiming}
        />
        <SceneOrder
          universeId={universeId}
          muralId={scene.mural_id}
          sceneId={scene.master_id}
          sceneLabel={shortTitle}
          orderedSceneIds={muralSceneIds}
          canAuthor={canAuthorOrder}
        />
        <ScenePresence
          universeId={universeId}
          sceneId={scene.master_id}
          sceneLabel={shortTitle}
          related={related}
          candidates={candidates}
          sharedIds={sharedIds}
          canAuthor={canAuthorPresence}
        />
        {panelBody}
        <p className="suite-object-actions">
          <Link href={openHref} className="suite-open-link">
            {openLabel}
            <span className="sr-only"> for scene {shortTitle}</span>
          </Link>
        </p>
      </div>
    </article>
  );
}

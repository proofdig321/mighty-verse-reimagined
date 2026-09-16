"use client";

import { useState } from "react";
import Link from "next/link";
import { sceneShortTitle } from "@/lib/assemble/composition";
import type { UniverseAssemblyMoment } from "@/lib/assemble";
import type { PresenceOption } from "@/lib/assemble/presence";
import { cn } from "@/lib/utils";
import { CreativeMomentIdentity } from "./creative-moment-identity-authoring";
import { MomentPresence } from "./presence-authoring";
import { StudioOverflowItem, StudioOverflowLink, StudioOverflowMenu } from "./studio-overflow-menu";

export function CreativeMomentObject({
  moment,
  candidates,
  universeId,
  canAuthorPresence,
  canAuthorIdentity,
  openHref,
  openLabel,
  compact = false,
}: {
  moment: UniverseAssemblyMoment;
  candidates: PresenceOption[];
  universeId: string;
  canAuthorPresence: boolean;
  canAuthorIdentity: boolean;
  openHref: string;
  openLabel: string;
  compact?: boolean;
}) {
  const [panel, setPanel] = useState<"identity" | "presence" | null>(null);
  const title = moment.title?.trim() || "Untitled Creative Moment";
  const shared = moment.scene_ids.length > 1;
  const headingId = `universe-moment-heading-${moment.master_id}`;
  const related: PresenceOption[] = moment.scene_ids.map((id, index) => ({
    master_id: id,
    title: sceneShortTitle(moment.scene_titles[index]) ?? moment.scene_titles[index] ?? "Untitled scene",
  }));

  const actions = (
    <StudioOverflowMenu label={`Creative Moment actions for ${title}`}>
      {canAuthorIdentity ? (
        <StudioOverflowItem onSelect={() => setPanel("identity")}>Edit identity</StudioOverflowItem>
      ) : null}
      {canAuthorPresence ? (
        <StudioOverflowItem onSelect={() => setPanel("presence")}>Add presence</StudioOverflowItem>
      ) : null}
      <StudioOverflowLink href={openHref}>{openLabel}</StudioOverflowLink>
    </StudioOverflowMenu>
  );

  return (
    <article
      id={`universe-moment-${moment.master_id}`}
      className={cn("suite-moment-object", compact && "is-compact")}
      data-moment-id={moment.master_id}
      data-related-scenes={moment.scene_ids.join(" ") || undefined}
      aria-labelledby={headingId}
    >
      <div className="suite-moment-row">
        <div className="min-w-0">
          <p className="suite-moment-kicker">Creative Moment</p>
          <h3 id={headingId} className="suite-moment-title">
            {title}
          </h3>
          <p className="suite-moment-presence">
            {moment.has_experience ? "Experience representation present" : "Identity only"}
            {shared ? " · Shared across Scenes" : ""}
          </p>
          <p className="suite-meta-status">
            {related.length > 0 ? `Scene · ${related.length}` : "No Scene relation"}
          </p>
        </div>
        <div className="suite-scene-row-actions">{actions}</div>
      </div>
      {compact && !panel && moment.description?.trim() ? null : moment.description?.trim() && !compact ? (
        <p className="suite-scene-description">{moment.description.trim()}</p>
      ) : null}
      {panel === "identity" || !compact ? (
        <CreativeMomentIdentity
          universeId={universeId}
          momentId={moment.master_id}
          momentLabel={title}
          title={moment.title ?? ""}
          description={moment.description ?? ""}
          canAuthor={canAuthorIdentity}
          startOpen={panel === "identity"}
          hideTrigger={compact}
        />
      ) : null}
      <MomentPresence
        universeId={universeId}
        momentId={moment.master_id}
        momentLabel={title}
        related={related}
        candidates={candidates}
        canAuthor={canAuthorPresence}
      />
      {!compact ? (
        <p className="suite-object-actions">
          <Link href={openHref} className="suite-open-link">
            {openLabel}
            <span className="sr-only"> for Creative Moment {title}</span>
          </Link>
        </p>
      ) : null}
    </article>
  );
}

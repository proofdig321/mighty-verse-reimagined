import Link from "next/link";
import { sceneShortTitle } from "@/lib/assemble/composition";
import type { UniverseAssemblyMoment } from "@/lib/assemble";
import type { PresenceOption } from "@/lib/assemble/presence";
import { MomentPresence } from "./presence-authoring";

export function CreativeMomentObject({
  moment,
  candidates,
  universeId,
  canAuthorPresence,
  openHref,
  openLabel,
}: {
  moment: UniverseAssemblyMoment;
  candidates: PresenceOption[];
  universeId: string;
  canAuthorPresence: boolean;
  openHref: string;
  openLabel: string;
}) {
  const title = moment.title?.trim() || "Untitled Creative Moment";
  const shared = moment.scene_ids.length > 1;
  const headingId = `universe-moment-heading-${moment.master_id}`;
  const related: PresenceOption[] = moment.scene_ids.map((id, index) => ({
    master_id: id,
    title: sceneShortTitle(moment.scene_titles[index]) ?? moment.scene_titles[index] ?? "Untitled scene",
  }));

  return (
    <article
      id={`universe-moment-${moment.master_id}`}
      className="suite-moment-object"
      data-moment-id={moment.master_id}
      data-related-scenes={moment.scene_ids.join(" ") || undefined}
      aria-labelledby={headingId}
    >
      <p className="suite-moment-kicker">Creative Moment</p>
      <h3 id={headingId} className="suite-moment-title">
        {title}
      </h3>
      <p className="suite-moment-presence">
        {moment.has_experience ? "Experience representation present" : "Identity only"}
        {shared ? " · Shared across Scenes" : ""}
      </p>
      <MomentPresence
        universeId={universeId}
        momentId={moment.master_id}
        momentLabel={title}
        related={related}
        candidates={candidates}
        canAuthor={canAuthorPresence}
      />
      <p className="suite-object-actions">
        <Link href={openHref} className="suite-open-link">
          {openLabel}
          <span className="sr-only"> for Creative Moment {title}</span>
        </Link>
      </p>
    </article>
  );
}

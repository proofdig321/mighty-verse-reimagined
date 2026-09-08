import Link from "next/link";
import { sceneShortTitle } from "@/lib/assemble/composition";
import type { UniverseAssemblyMoment } from "@/lib/assemble";

export function CreativeMomentObject({
  moment,
  openHref,
  openLabel,
}: {
  moment: UniverseAssemblyMoment;
  openHref: string;
  openLabel: string;
}) {
  const title = moment.title?.trim() || "Untitled Creative Moment";
  const shared = moment.scene_ids.length > 1;
  const headingId = `universe-moment-heading-${moment.master_id}`;
  const relatedScenes = moment.scene_ids.map((id, index) => ({
    id,
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
      {relatedScenes.length > 0 ? (
        <div className="suite-moment-scenes">
          <p className="suite-relation-kicker">
            Related Scene{relatedScenes.length === 1 ? "" : "s"}
          </p>
          <ul>
            {relatedScenes.map((scene) => (
              <li key={scene.id}>
                <Link href={`#universe-scene-${scene.id}`} className="suite-relation-link">
                  {scene.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="italic text-muted-foreground/70 text-sm">No Scene relation</p>
      )}
      <p className="suite-object-actions">
        <Link href={openHref} className="suite-open-link">
          {openLabel}
          <span className="sr-only"> for Creative Moment {title}</span>
        </Link>
      </p>
    </article>
  );
}

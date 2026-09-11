import Link from "next/link";
import { cn } from "@/lib/utils";

export function CreativeMomentCard({
  masterId,
  title,
  stillUrl,
  href,
  sceneTitles,
  kind,
  copyMode = "always",
  hasMomentProjection,
  active = null,
  interactive = false,
  onSelect,
}: {
  masterId: string;
  title: string;
  stillUrl: string | null;
  href?: string | null;
  sceneTitles: string[];
  kind: string;
  copyMode?: "always" | "hover";
  hasMomentProjection?: boolean;
  active?: boolean | null;
  interactive?: boolean;
  onSelect?: () => void;
}) {
  const headingId = `moment-card-${masterId}`;
  const presence =
    sceneTitles.length > 1
      ? `Present across ${sceneTitles.join(" and ")}`
      : sceneTitles.length === 1
        ? `Present in ${sceneTitles[0]}`
        : null;

  const media = stillUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={stillUrl} alt="" className="moment-card-still" />
  ) : (
    <div className="moment-card-still moment-card-still-empty" aria-hidden="true" />
  );

  const copy = (
    <div className={cn("moment-card-copy", copyMode === "hover" && "moment-card-copy-hover")}>
      <h3 id={headingId} className="world-presence-title">
        {title}
      </h3>
      <div className={cn(copyMode === "hover" && "moment-card-meta")}>
        <p className="world-presence-kind">{kind}</p>
        {presence ? <p className="world-presence-scenes">{presence}</p> : null}
      </div>
    </div>
  );

  const body = (
    <>
      {media}
      {copy}
      {href ? (
        <Link href={href} className="world-presence-link">
          View Creative Moment
          <span className="sr-only">{` ${title}`}</span>
        </Link>
      ) : null}
    </>
  );

  const className = cn(
    "world-presence moment-card holographic-layer holographic-layer-moment",
    active === true && "holographic-layer-active",
    active === false && "holographic-layer-inactive",
  );

  if (interactive && onSelect) {
    return (
      <article
        className={className}
        data-moment-id={masterId}
        data-holographic-kind="moment"
        data-master-id={masterId}
        data-layer-active={active == null ? undefined : active ? "true" : "false"}
        data-has-moment-projection={hasMomentProjection == null ? undefined : hasMomentProjection ? "true" : "false"}
        aria-labelledby={headingId}
      >
        <button type="button" className="moment-card-trigger" onClick={onSelect}>
          {media}
          {copy}
        </button>
        {href ? (
          <Link href={href} className="world-presence-link">
            View Creative Moment
            <span className="sr-only">{` ${title}`}</span>
          </Link>
        ) : null}
      </article>
    );
  }

  return (
    <article
      className={className}
      data-moment-id={masterId}
      data-holographic-kind="moment"
      data-master-id={masterId}
        data-layer-active={active == null ? undefined : active ? "true" : "false"}
      data-has-moment-projection={hasMomentProjection == null ? undefined : hasMomentProjection ? "true" : "false"}
      aria-labelledby={headingId}
    >
      {body}
    </article>
  );
}

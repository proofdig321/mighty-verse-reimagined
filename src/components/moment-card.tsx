import Link from "next/link";

type Props = {
  projectionId?: string;
  title: string | null;
  typeLabel: string;
  hasMedia: boolean;
  collectible: boolean;
};

export default function MomentCard({ projectionId, title, typeLabel, hasMedia, collectible }: Props) {
  const displayTitle = title ?? typeLabel;
  const hasTitle = !!title;

  const inner = (
    <>
      <div className="min-w-0 space-y-0.5">
        <p
          className="text-sm font-medium text-foreground truncate group-hover:opacity-80 transition-opacity"
          style={hasTitle ? { fontFamily: "var(--font-display, inherit)" } : undefined}
        >
          {displayTitle}
        </p>
        {hasTitle && (
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{typeLabel}</p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {collectible && (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full border"
            style={{ color: "var(--accent-mv)", borderColor: "var(--accent-mv)" }}
          >
            collectible
          </span>
        )}
        {hasMedia
          ? <span className="text-sm" style={{ color: "var(--accent-mv)" }}>▶</span>
          : projectionId ? <span className="text-muted-foreground text-xs group-hover:text-foreground transition-colors">→</span> : null
        }
      </div>
    </>
  );

  const className = "group flex items-center justify-between gap-4 px-5 py-4 rounded-lg border border-border bg-card hover:border-foreground/20 transition-colors";

  if (projectionId) {
    return <Link href={`/moments/${projectionId}`} className={className}>{inner}</Link>;
  }

  return <div className={className}>{inner}</div>;
}

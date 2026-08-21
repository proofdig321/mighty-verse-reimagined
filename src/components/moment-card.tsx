import Link from "next/link";

type Props = {
  projectionId: string;
  title: string | null;
  typeLabel: string;
  hasMedia: boolean;
  collectible: boolean;
};

export default function MomentCard({ projectionId, title, typeLabel, hasMedia, collectible }: Props) {
  const displayTitle = title ?? typeLabel;
  const hasTitle = !!title;

  return (
    <Link
      href={`/moments/${projectionId}`}
      className="group flex items-center justify-between gap-4 px-4 py-3.5 rounded-lg border border-border bg-card hover:border-foreground/25 hover:bg-muted/40 transition-all"
    >
      <div className="min-w-0 space-y-0.5">
        <p
          className="text-sm font-medium text-foreground truncate"
          style={hasTitle ? { fontFamily: "var(--font-display, inherit)" } : undefined}
        >
          {displayTitle}
        </p>
        {hasTitle && (
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{typeLabel}</p>
        )}
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {hasMedia && (
          <span
            className="text-xs font-medium"
            style={{ color: "var(--accent-mv)" }}
          >
            ▶
          </span>
        )}
        {collectible && (
          <span
            className="text-xs font-medium px-1.5 py-0.5 rounded-full border"
            style={{ color: "var(--accent-mv)", borderColor: "var(--accent-mv)" }}
          >
            collectible
          </span>
        )}
        <span className="text-muted-foreground text-xs group-hover:text-foreground transition-colors">→</span>
      </div>
    </Link>
  );
}

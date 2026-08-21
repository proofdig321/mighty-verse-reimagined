export const dynamic = "force-dynamic";

import Link from "next/link";
import { getDiscovery } from "@/lib/discovery";
import MomentCard from "@/components/moment-card";

const TYPE_LABELS: Record<string, string> = {
  "song-world": "Song World",
  "creative-moment": "Creative Moment",
  "mural": "Mural",
  "interpretation": "Interpretation",
  "other": "Work",
};

const PROJ_LABELS: Record<string, string> = {
  "experiential": "Experiential",
  "distributional": "Distributional",
  "archival": "Archival",
  "other": "Moment",
};

export default async function HomePage() {
  const worlds = await getDiscovery();

  if (worlds.length === 0) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 pt-16">
          <p className="text-muted-foreground text-sm">No worlds yet.</p>
        </div>
      </main>
    );
  }

  const featured = worlds.filter((w) => !!w.title);
  const secondary = worlds.filter((w) => !w.title);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 pt-10 pb-16 space-y-16">

        {/* Featured works — titled, with media and credit */}
        {featured.length > 0 && (
          <section className="space-y-10">
            {featured.map((w) => {
              const typeLabel = TYPE_LABELS[w.canonical_type] ?? w.canonical_type.replace(/-/g, " ");
              const credit = w.description ?? (
                w.attribution_roles.length > 0
                  ? w.attribution_roles.map(r => r.replace(/-/g, " ")).join(" · ")
                  : null
              );

              return (
                <div key={w.master_id} className="space-y-4">
                  <Link href={`/worlds/${w.master_id}`} className="group block space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <h2
                        className="text-3xl font-semibold text-foreground group-hover:opacity-80 transition-opacity leading-tight tracking-tight"
                        style={{ fontFamily: "var(--font-display, inherit)" }}
                      >
                        {w.title}
                      </h2>
                      {w.has_media && (
                        <span
                          className="shrink-0 mt-2 text-sm font-medium"
                          style={{ color: "var(--accent-mv)" }}
                        >
                          ▶
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs uppercase tracking-widest">{typeLabel}</p>
                    {credit && (
                      <p className="text-foreground/60 text-sm">{credit}</p>
                    )}
                  </Link>

                  {w.projections.length > 0 && (
                    <div className="pl-4 border-l border-border space-y-2">
                      {w.projections.map((p) => (
                        <MomentCard
                          key={p.projection_id}
                          projectionId={p.projection_id}
                          title={p.title}
                          typeLabel={PROJ_LABELS[p.projection_type] ?? p.projection_type.replace(/-/g, " ")}
                          hasMedia={p.has_media}
                          collectible={p.collectible_designated}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* Secondary works — untitled, receded */}
        {secondary.length > 0 && (
          <section className="space-y-1 border-t border-border pt-8">
            {secondary.map((w) => {
              const typeLabel = TYPE_LABELS[w.canonical_type] ?? w.canonical_type.replace(/-/g, " ");
              return (
                <Link
                  key={w.master_id}
                  href={`/worlds/${w.master_id}`}
                  className="group flex items-center justify-between gap-4 py-2.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="text-sm">{typeLabel}</span>
                  <span className="text-xs font-mono opacity-40 group-hover:opacity-70 transition-opacity">
                    {w.master_id.slice(0, 8)}
                  </span>
                </Link>
              );
            })}
          </section>
        )}

      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";

import Link from "next/link";
import { getDiscovery } from "@/lib/discovery";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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

function typeLabel(s: string) {
  return TYPE_LABELS[s] ?? s.replace(/-/g, " ");
}

function projLabel(s: string) {
  return PROJ_LABELS[s] ?? s.replace(/-/g, " ");
}

export default async function HomePage() {
  const worlds = await getDiscovery();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 pt-8 pb-16 space-y-10">

        {worlds.length === 0 ? (
          <p className="text-muted-foreground text-sm pt-8">No worlds yet.</p>
        ) : (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-foreground text-xs font-medium uppercase tracking-wider">Worlds</h2>
              <Separator className="flex-1" />
            </div>

            <div className="space-y-6">
              {worlds.map((w) => (
                <div key={w.master_id} className="space-y-2">
                  {/* World card */}
                  <Link href={`/worlds/${w.master_id}`} className="block group">
                    <Card className="transition-colors group-hover:border-foreground/20">
                      <CardContent className="pt-4 pb-4 flex items-center justify-between gap-4">
                        <div className="space-y-1 min-w-0">
                          <p className="text-foreground text-sm font-medium">{typeLabel(w.canonical_type)}</p>
                          {w.attribution_roles.length > 0 && (
                            <p className="text-muted-foreground text-xs capitalize">
                              {w.attribution_roles.map(r => r.replace(/-/g, " ")).join(" · ")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {w.has_media && (
                            <span className="text-xs text-foreground">● playable</span>
                          )}
                          <span className="text-muted-foreground text-xs">→</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  {/* Nested Moments */}
                  {w.projections.length > 0 && (
                    <div className="pl-4 space-y-1.5">
                      {w.projections.map((p) => (
                        <Link
                          key={p.projection_id}
                          href={`/moments/${p.projection_id}`}
                          className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-border hover:border-foreground/20 hover:bg-muted/30 transition-colors group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-muted-foreground text-xs">Moment</span>
                            <span className="text-muted-foreground text-xs">·</span>
                            <span className="text-muted-foreground text-xs">{projLabel(p.projection_type)}</span>
                            {p.collectible_designated && (
                              <Badge variant="outline" className="text-xs py-0">collectible</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {p.has_media && (
                              <span className="text-xs text-foreground">● playable</span>
                            )}
                            <span className="text-muted-foreground text-xs group-hover:text-foreground transition-colors">→</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}

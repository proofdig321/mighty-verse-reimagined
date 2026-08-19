import Link from "next/link";
import { getDiscovery } from "@/lib/discovery";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function label(s: string) {
  return s.replace(/-/g, " ");
}

export default async function HomePage() {
  const worlds = await getDiscovery();

  // Collect all projections across worlds for the Moments section
  const moments = worlds.flatMap((w) =>
    w.projections.map((p) => ({ ...p, master_id: w.master_id, canonical_type: w.canonical_type, attribution_roles: w.attribution_roles }))
  );

  return (
    <main className="min-h-screen bg-background">

      {/* Identity */}
      <header className="px-4 pt-12 pb-8 text-center">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Mighty Verse</h1>
        <p className="text-muted-foreground text-sm mt-1">A canonical media universe</p>
      </header>

      <div className="mx-auto max-w-2xl px-4 space-y-10 pb-16">

        {/* Worlds */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-foreground text-sm font-medium uppercase tracking-wider">Worlds</h2>
            <Separator className="flex-1" />
          </div>

          {worlds.length === 0 ? (
            <p className="text-muted-foreground text-sm">No worlds yet.</p>
          ) : (
            <div className="space-y-3">
              {worlds.map((w) => (
                <Link key={w.master_id} href={`/worlds/${w.master_id}`} className="block group">
                  <Card className="transition-colors group-hover:border-foreground/20">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="capitalize">{label(w.canonical_type)}</Badge>
                            <Badge variant="secondary">v{w.canonical_state_version}</Badge>
                            <Badge className="capitalize">{w.authorisation_state}</Badge>
                          </div>
                          {w.attribution_roles.length > 0 && (
                            <div className="flex gap-1.5 flex-wrap">
                              {w.attribution_roles.map((r) => (
                                <span key={r} className="text-muted-foreground text-xs capitalize">{label(r)}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Media availability indicator */}
                        <span className={`text-xs shrink-0 ${w.has_media ? "text-foreground" : "text-muted-foreground/40"}`}>
                          {w.has_media ? "● media" : "○ pending"}
                        </span>
                      </div>
                      <p className="text-muted-foreground font-mono text-xs truncate">{w.master_id}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Moments */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-foreground text-sm font-medium uppercase tracking-wider">Moments</h2>
            <Separator className="flex-1" />
          </div>

          {moments.length === 0 ? (
            <p className="text-muted-foreground text-sm">No moments yet.</p>
          ) : (
            <div className="space-y-3">
              {moments.map((p) => (
                <Link key={p.projection_id} href={`/moments/${p.projection_id}`} className="block group">
                  <Card className="transition-colors group-hover:border-foreground/20">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="capitalize">{label(p.projection_type)}</Badge>
                            {p.collectible_designated && <Badge variant="outline">collectible</Badge>}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="capitalize">{label(p.canonical_type)}</span>
                            <span>·</span>
                            {p.attribution_roles.map((r) => (
                              <span key={r} className="capitalize">{label(r)}</span>
                            ))}
                          </div>
                        </div>
                        <span className={`text-xs shrink-0 ${p.has_media ? "text-foreground" : "text-muted-foreground/40"}`}>
                          {p.has_media ? "● media" : "○ pending"}
                        </span>
                      </div>
                      <p className="text-muted-foreground font-mono text-xs truncate">{p.projection_id}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDuration } from "@/lib/media/timing";
import {
  MEDIA_INTAKE_HREF,
  creativeSuiteHref,
  curateStudioHref,
  mediaInspectHref,
  studioInspectionLabel,
  studioReadinessLabel,
  type CurateStudioMedia,
} from "@/lib/assemble/studio";
import { associationStatusLabel } from "@/lib/assemble/association";
import type { CurateStudioUniverse } from "@/lib/assemble/load-studio";
import { AssociateWithUniverse } from "./associate-with-universe";
import { CurateUniverseSelect } from "./curate-universe-select";
import { RegisterMural } from "./register-mural";

function untitled(kind: string) {
  return <span className="italic text-muted-foreground">Untitled {kind}</span>;
}

export default function CurateStudioGateway({
  media,
  universes,
  selectedUniverseId,
}: {
  media: CurateStudioMedia[];
  universes: CurateStudioUniverse[];
  selectedUniverseId: string | null;
}) {
  const selected = universes.find((universe) => universe.master_id === selectedUniverseId) ?? null;
  const selectedMedia = selectedUniverseId
    ? media.filter((item) => item.association.universe_id === selectedUniverseId)
    : [];

  return (
    <div className="space-y-10">
      <section className="space-y-3" aria-labelledby="curate-incoming">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h2 id="curate-incoming" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Incoming / Media
            </h2>
            <p className="text-sm text-muted-foreground max-w-3xl">
              What has arrived. These are media assets — not Universes. Sentinel inspects them.
              Creative meaning is assembled in Creative Suite.
            </p>
          </div>
          <Link href={MEDIA_INTAKE_HREF} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Add media
          </Link>
        </div>

        {media.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-border bg-card/30 px-5 py-6">
            No incoming media yet. Register an intake first. Uploading media does not create a Universe.
          </p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/20">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Media</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Status</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Sentinel</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Canonical work</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Next</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {media.map((item) => {
                  const suiteHref = item.association.universe_id
                    ? creativeSuiteHref(item.association.universe_id, "curate")
                    : null;
                  return (
                    <tr key={item.asset_id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{item.title ?? untitled("media")}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          {item.provider ?? "unknown"}
                          {item.duration_ms != null ? ` · ${formatDuration(item.duration_ms / 1000)}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Badge variant="outline">{studioReadinessLabel(item.readiness_overall)}</Badge>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                        {studioInspectionLabel(item.inspection)}
                        {item.inspection?.candidate_count != null ? ` · ${item.inspection.candidate_count} candidates` : ""}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted-foreground">
                        {item.association.universe_id ? (
                          <span>
                            <span>{associationStatusLabel(item.association)}</span>
                            {item.association.mural_title ? (
                              <span className="text-muted-foreground"> · Mural {item.association.mural_title}</span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="italic text-muted-foreground/50">Not associated — media is not a Universe</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-3">
                          <Link
                            href={mediaInspectHref(item.asset_id)}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Inspect
                          </Link>
                          {item.association.universe_id && (
                            <Link
                              href={curateStudioHref(item.association.universe_id)}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Sentinel
                            </Link>
                          )}
                          {suiteHref ? (
                            <Link
                              href={suiteHref}
                              className="text-xs text-foreground hover:underline"
                            >
                              Open Creative Suite
                            </Link>
                          ) : (
                            <AssociateWithUniverse media={item} universes={universes} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="curate-context">
        <div className="space-y-1">
          <h2 id="curate-context" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Curation context
          </h2>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Choose an existing Universe to inspect its mural-bound media and enter Creative Suite.
            Creating a new canonical work remains a separate Authority operation.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card px-5 py-4 space-y-4">
          <CurateUniverseSelect universes={universes} selectedUniverseId={selectedUniverseId} />

          {selected ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                {selected.title ?? untitled("universe")} is the canonical work. Media bound to its Mural or Scenes can be inspected here. Identity, Mural, Scenes, and Creative Moments are assembled in Creative Suite.
              </p>
              {selectedMedia.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedMedia.length} associated media record{selectedMedia.length === 1 ? "" : "s"} in this Universe.
                </p>
              )}
              {(selected.target.blocked_reason === "no_mural" ||
                selected.target.blocked_reason === "no_projection") && (
                <div className="space-y-2 rounded-md border border-border bg-background px-4 py-3">
                  <p className="text-sm text-foreground">
                    {selected.target.blocked_reason === "no_mural"
                      ? "This Universe has no Mural yet. Register the Mural to establish the audiovisual container. This does not attach media."
                      : "This Universe's Mural has no presentation yet. Register the Mural presentation. This does not attach media."}
                  </p>
                  <RegisterMural
                    universeId={selected.master_id}
                    universeTitle={selected.title}
                    fromCurate
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Link href={creativeSuiteHref(selected.master_id, "curate")} className={buttonVariants({ size: "sm" })}>
                  Open Creative Suite
                </Link>
                <Link href={`/authority/${selected.master_id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Canonical record
                </Link>
                <Link href={`/worlds/${selected.master_id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  View public experience
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No Universe selected. Incoming media stays in intake until an operator associates it with an existing creative work. It does not become a Universe by being uploaded.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

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
import type { CurateAssetFocus } from "@/lib/assemble/curate-context";
import type { CurateStudioUniverse } from "@/lib/assemble/load-studio";
import { AssociateWithUniverse } from "./associate-with-universe";
import { CurateUniverseSelect } from "./curate-universe-select";
import { RegisterMural } from "./register-mural";
import { CurateContinuationLinks } from "./curate-continuation";

function untitled(kind: string) {
  return <span className="italic text-muted-foreground">Untitled {kind}</span>;
}

function CurateAssetContextBanner({ focusedAsset }: { focusedAsset: CurateAssetFocus }) {
  if (focusedAsset.next === "unavailable") {
    return (
      <div
        role="status"
        className="rounded-lg border border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground"
      >
        This media is not available in Curate Studio. The requested asset is not in the incoming
        catalogue. Association still requires a real catalogue record.
      </div>
    );
  }

  if (focusedAsset.next === "creative_suite" && focusedAsset.universe_id) {
    const work = focusedAsset.universe_title ?? "its canonical work";
    return (
      <div
        role="status"
        className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3"
      >
        <p className="text-sm text-foreground">
          This selected media is already associated with {work}
          {focusedAsset.mural_title ? ` · Mural ${focusedAsset.mural_title}` : ""}.
        </p>
        <CurateContinuationLinks
          universeId={focusedAsset.universe_id}
          assetId={focusedAsset.asset_id}
          associated
          mediaAttached
        />
      </div>
    );
  }

  return (
    <div
      role="status"
      className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground"
    >
      Continuing with the media selected from Gallery or Inspect. Associate it with an existing
      Universe to curate it. Inspection does not associate automatically.
    </div>
  );
}

export default function CurateStudioGateway({
  media,
  universes,
  selectedUniverseId,
  focusedAsset,
}: {
  media: CurateStudioMedia[];
  universes: CurateStudioUniverse[];
  selectedUniverseId: string | null;
  focusedAsset: CurateAssetFocus | null;
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
              What has arrived. These are media assets — not Universes. Uploading media does not create a Universe.
              Sentinel inspects them. Creative meaning is assembled in Creative Studio.
            </p>
          </div>
          <Link href={MEDIA_INTAKE_HREF} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Add media
          </Link>
        </div>

        {focusedAsset ? <CurateAssetContextBanner focusedAsset={focusedAsset} /> : null}

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
                  const isFocused = focusedAsset?.found === true && focusedAsset.asset_id === item.asset_id;
                  return (
                    <tr
                      key={item.asset_id}
                      aria-current={isFocused ? "true" : undefined}
                      className={
                        isFocused
                          ? "bg-muted/40 hover:bg-muted/50 transition-colors"
                          : "hover:bg-muted/20 transition-colors"
                      }
                    >
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
                              href={curateStudioHref(item.association.universe_id, item.asset_id)}
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
                              Open Creative Studio
                            </Link>
                          ) : (
                            <AssociateWithUniverse
                              media={item}
                              universes={universes}
                              defaultOpen={isFocused && focusedAsset?.next === "associate"}
                            />
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
            Choose an existing Universe to shape it here. Creative Studio is for precision composition.
            Creating a new canonical work remains a separate Create Work operation.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card px-5 py-4 space-y-4">
          <CurateUniverseSelect universes={universes} selectedUniverseId={selectedUniverseId} />

          {selected ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                {selected.title ?? untitled("universe")} is the canonical work. Use the hub above for what is true and what needs you. Precision composition lives in Creative Studio.
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
                      ? "This Universe has no Mural yet. Register the Mural to establish the audiovisual container. This is not minting and does not attach media."
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
                  Open Creative Studio
                </Link>
                <Link href={`/authority/${selected.master_id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Canonical record
                </Link>
              </div>
              <CurateContinuationLinks
                universeId={selected.master_id}
                assetId={selectedMedia[0]?.asset_id ?? null}
                associated={selectedMedia.length > 0}
                mediaAttached={selectedMedia.length > 0}
              />
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

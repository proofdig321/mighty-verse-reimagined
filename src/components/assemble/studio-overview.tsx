import type { ReactNode } from "react";
import Link from "next/link";
import { formatDuration } from "@/lib/media/timing";
import { suiteScenes } from "@/lib/assemble";
import { CanonicalIdentifiers, MuralEmpty, MuralPresence } from "./mural-presence";
import { StudioSceneDeck } from "./studio-scene-deck";
import { RegisterMural } from "./register-mural";
import type { StudioWorkspace } from "@/lib/assemble/load-studio-workspace";
import { mediaInspectHref, creativeSuiteWorkspaceHref } from "@/lib/assemble/studio";

export function StudioOverview({
  workspace,
  muralEmptyAction,
}: {
  workspace: StudioWorkspace;
  muralEmptyAction?: ReactNode;
}) {
  const { data, source, intelligence, productionBriefs, inspectAssetId, fromCurate } = workspace;
  const scenes = suiteScenes(data);
  const realised = productionBriefs.filter((brief) => brief.projects || brief.realization).length;
  const storyboardReady = (intelligence?.storyboard.length ?? 0) > 0;
  const previewReady = (intelligence?.holographic.length ?? 0) > 0;
  const durationLabel = source?.duration_ms ? formatDuration(source.duration_ms / 1000) : null;
  const from = fromCurate ? "curate" : null;
  const mural = data.murals[0] ?? null;

  const stats = [
    {
      label: "Source",
      value: durationLabel ?? (source ? "Bound" : "None"),
      href: creativeSuiteWorkspaceHref(data.master_id, "preview", from),
    },
    {
      label: "Scenes",
      value: String(scenes.length),
      href: creativeSuiteWorkspaceHref(data.master_id, "scenes", from),
    },
    {
      label: "Creative Moments",
      value: String(data.creative_moments.length),
      href: creativeSuiteWorkspaceHref(data.master_id, "scenes", from),
    },
    {
      label: "Storyboard",
      value: storyboardReady ? "Ready" : "Waiting",
      href: creativeSuiteWorkspaceHref(data.master_id, "storyboard", from),
    },
    {
      label: "Production",
      value: `${realised}/${Math.max(productionBriefs.length, scenes.length) || 0} realised`,
      href: creativeSuiteWorkspaceHref(data.master_id, "production", from),
    },
    {
      label: "2.5D",
      value: previewReady ? "Preview available" : "Waiting",
      href: creativeSuiteWorkspaceHref(data.master_id, "preview", from),
    },
  ];

  return (
    <div className="suite-stack">
      <dl className="studio-command-grid">
        {stats.map((stat) => (
          <div key={stat.label} className="studio-command-card">
            <Link href={stat.href}>
              <dt className="suite-kicker">{stat.label}</dt>
              <dd className="text-lg font-medium text-foreground">{stat.value}</dd>
            </Link>
          </div>
        ))}
      </dl>

      {scenes.length > 0 ? (
        <section className="suite-section" aria-labelledby="studio-scene-deck">
          <div className="suite-section-head">
            <h2 id="studio-scene-deck" className="suite-section-title">
              Scene deck
            </h2>
          </div>
          <StudioSceneDeck universeId={data.master_id} scenes={scenes} from={from} />
        </section>
      ) : null}

      <details className="studio-inspector">
        <summary>Source and mural</summary>
        <div className="studio-inspector-body">
          <section className="suite-section" aria-labelledby="universe-source">
            <div className="suite-section-head">
              <h2 id="universe-source" className="suite-section-title">
                Source
              </h2>
            </div>
            {source ? (
              <p className="text-sm text-foreground">
                {durationLabel ?? "Bound source media"}. Play it in 2.5D.
                {inspectAssetId ? (
                  <>
                    {" "}
                    <Link href={mediaInspectHref(inspectAssetId)} className="underline">
                      Inspect
                    </Link>
                  </>
                ) : null}
              </p>
            ) : (
              <p className="suite-empty">No source media is bound to this Universe yet.</p>
            )}
          </section>

          <section className="suite-section" aria-labelledby="universe-mural">
            <div className="suite-section-head">
              <h2 id="universe-mural" className="suite-section-title">
                Mural
              </h2>
            </div>
            {data.murals.length === 0 ? (
              muralEmptyAction ?? (
                <MuralEmpty>
                  <RegisterMural universeId={data.master_id} universeTitle={data.title} fromCurate={fromCurate} />
                </MuralEmpty>
              )
            ) : mural ? (
              <MuralPresence mural={mural} openHref={`/authority/${mural.master_id}`} openLabel="Open record" />
            ) : null}
          </section>

          <CanonicalIdentifiers
            items={[
              { label: "Master", value: data.master_id },
              { label: "Created", value: data.created_at.slice(0, 10) },
            ]}
          />
        </div>
      </details>
    </div>
  );
}

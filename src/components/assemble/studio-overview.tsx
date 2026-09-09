import type { ReactNode } from "react";
import Link from "next/link";
import { formatDuration } from "@/lib/media/timing";
import { sceneShortTitle, sceneStillUrl, suiteScenes } from "@/lib/assemble";
import { CanonicalIdentifiers, MuralEmpty, MuralPresence } from "./mural-presence";
import { ProductionPath } from "./production-path";
import { SourcePreview } from "./source-preview";
import { CreativeStill } from "./creative-still";
import { providerThumbnailUrl } from "@/lib/media/thumbnail";
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
  const { data, source, intelligence, productionPath, productionBriefs, inspectAssetId, fromCurate } = workspace;
  const scenes = suiteScenes(data);
  const realised = productionBriefs.filter((brief) => brief.projects || brief.realization).length;
  const storyboardReady = (intelligence?.storyboard.length ?? 0) > 0;
  const previewReady = (intelligence?.holographic.length ?? 0) > 0;
  const durationLabel = source?.duration_ms ? formatDuration(source.duration_ms / 1000) : null;
  const from = fromCurate ? "curate" : null;

  const stats = [
    {
      label: "Source",
      value: durationLabel ?? (source ? "Bound" : "None"),
      href: null,
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
      <section className="suite-section" aria-labelledby="universe-identity">
        <div className="suite-identity">
          <p className="suite-kicker">Universe</p>
          <h2 id="universe-identity" className="suite-section-title">
            Identity
          </h2>
          <p className="suite-identity-title">{data.title ?? <span className="italic text-muted-foreground">Untitled universe</span>}</p>
          <p className="suite-identity-description">
            {data.description ?? <span className="italic text-muted-foreground">No description yet.</span>}
          </p>
          <CanonicalIdentifiers
            items={[
              { label: "Master", value: data.master_id },
              { label: "Created", value: data.created_at.slice(0, 10) },
            ]}
          />
        </div>
      </section>

      <dl className="studio-command-grid">
        {stats.map((stat) => {
          const body = (
            <>
              <dt className="suite-kicker">{stat.label}</dt>
              <dd className="text-lg font-medium text-foreground">{stat.value}</dd>
            </>
          );
          return (
            <div key={stat.label} className="studio-command-card">
              {stat.href ? <Link href={stat.href}>{body}</Link> : body}
            </div>
          );
        })}
      </dl>

      {productionPath.length > 0 ? <ProductionPath steps={productionPath} /> : null}

      {scenes.length > 0 ? (
        <section className="suite-section" aria-labelledby="studio-scene-deck">
          <div className="suite-section-head">
            <h2 id="studio-scene-deck" className="suite-section-title">
              Scene deck
            </h2>
            <p className="suite-section-note">
              Canonical Scenes for this Universe. Open a Scene to author it. Scene Deck shuffle on the public Universe remains presentation-only.
            </p>
          </div>
          <ol className="studio-scene-deck">
            {scenes.map((scene, index) => {
              const still = sceneStillUrl(scene);
              const url = still
                ? providerThumbnailUrl(still.provider, still.storage_ref, { timeSec: still.timeSec, width: 640 })
                : null;
              return (
                <li key={scene.master_id}>
                  <Link
                    href={creativeSuiteWorkspaceHref(data.master_id, "scenes", from, scene.master_id)}
                    className="studio-scene-card"
                    data-scene-id={scene.master_id}
                  >
                    <CreativeStill url={url} alt="" />
                    <p className="suite-kicker">
                      {String(index + 1).padStart(2, "0")} {sceneShortTitle(scene.title) ?? "Untitled"}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <section className="suite-section" aria-labelledby="universe-source">
        <div className="suite-section-head">
          <h2 id="universe-source" className="suite-section-title">
            Source
          </h2>
          <p className="suite-section-note">The bound audiovisual media. Preview is observational. It does not rewrite Scene windows.</p>
        </div>
        {source ? (
          <SourcePreview source={source} inspectHref={inspectAssetId ? mediaInspectHref(inspectAssetId) : null} />
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
        ) : (
          <div className="space-y-6">
            {data.murals.map((mural) => (
              <MuralPresence
                key={mural.master_id}
                mural={mural}
                openHref={`/authority/${mural.master_id}`}
                openLabel="Open record"
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

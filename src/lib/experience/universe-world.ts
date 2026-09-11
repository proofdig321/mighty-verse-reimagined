/**
 * Public Universe Experience helpers.
 *
 * Encounter language for an already-composed Universe. Does not invent
 * canonical objects, timings, or Moment Cards. Studio composition helpers
 * remain in assemble/; this layer only presents existing data.
 */

import { sceneOrdinal, sceneShortTitle, sceneStillUrl } from "../assemble/composition";
import { momentCardStillUrl } from "./moment-card";

export type UniverseSceneEncounter = {
  master_id: string;
  title: string | null;
  projection_id: string | null;
  playback_id: string | null;
  provider: string | null;
  start_ms: number | null;
  end_ms: number | null;
};

export type UniverseMomentPresence = {
  master_id: string;
  title: string | null;
  projection_id: string | null;
};

export type UniverseSceneMomentRel = {
  scene_master_id: string;
  moment_master_id: string;
};

export type UniverseMuralStage = {
  master_id: string;
  title: string | null;
  projection_id: string | null;
};

export type ContributorPresence = {
  master_id: string;
  title: string | null;
  href: string;
  hasMomentProjection: boolean;
  stillUrl: string | null;
  scenes: { master_id: string; title: string | null; shortTitle: string }[];
};

export { sceneOrdinal, sceneShortTitle, sceneStillUrl };

export function contributorPresence(
  moments: UniverseMomentPresence[],
  scenes: UniverseSceneEncounter[],
  relations: UniverseSceneMomentRel[],
): ContributorPresence[] {
  const scenesById = new Map(scenes.map((scene) => [scene.master_id, scene]));

  return moments.map((moment) => {
    const related = relations
      .filter((relation) => relation.moment_master_id === moment.master_id)
      .map((relation) => scenesById.get(relation.scene_master_id))
      .filter((scene): scene is UniverseSceneEncounter => Boolean(scene));
    const host = related[0] ?? null;

    return {
      master_id: moment.master_id,
      title: moment.title,
      href: `/creative-moments/${moment.master_id}`,
      hasMomentProjection: Boolean(moment.projection_id),
      stillUrl: momentCardStillUrl(
        host
          ? { provider: host.provider, storage_ref: host.playback_id, start_ms: host.start_ms }
          : null,
      ),
      scenes: related.map((scene) => ({
        master_id: scene.master_id,
        title: scene.title,
        shortTitle: sceneShortTitle(scene.title) ?? "Scene",
      })),
    };
  });
}

/**
 * Studio landing identity. One card per canonical Universe, plus standalone
 * Storyboard work. Attached work is not a second Universe card.
 */
import type { StoryboardWorkSummary } from "../storyboard/document";
import type { UniverseOccupancy } from "./occupancy";

const OCCUPANCY_RANK: Record<UniverseOccupancy, number> = {
  orphan: 0,
  in_progress: 1,
  curated: 2,
  withdrawn: 3,
};

export type StudioUniverseCard = {
  master_id: string;
  title: string;
  description: string | null;
  occupancy?: UniverseOccupancy;
  withdrawable?: boolean;
};

export type StudioStandaloneCard = {
  kind: "standalone";
  work: StoryboardWorkSummary;
  href: string;
};

export type StudioUniverseLandingCard = {
  kind: "universe";
  master_id: string;
  title: string;
  description: string | null;
  href: string;
  attached_work_count: number;
  attached_work_ids: string[];
  occupancy: UniverseOccupancy;
  withdrawable: boolean;
};

export type StudioLanding = {
  standalone: StudioStandaloneCard[];
  universes: StudioUniverseLandingCard[];
};

export function composeStudioLanding(
  universes: StudioUniverseCard[],
  works: StoryboardWorkSummary[],
): StudioLanding {
  const attachedIds = new Map<string, string[]>();
  const standalone: StudioStandaloneCard[] = [];

  for (const work of works) {
    if (work.universe_id) {
      const ids = attachedIds.get(work.universe_id) ?? [];
      ids.push(work.work_id);
      attachedIds.set(work.universe_id, ids);
      continue;
    }
    standalone.push({
      kind: "standalone",
      work,
      href: `/studio/work/${work.work_id}`,
    });
  }

  const seen = new Set<string>();
  const universeCards: StudioUniverseLandingCard[] = [];
  for (const universe of universes) {
    if (seen.has(universe.master_id)) continue;
    seen.add(universe.master_id);
    const attached = attachedIds.get(universe.master_id) ?? [];
    universeCards.push({
      kind: "universe",
      master_id: universe.master_id,
      title: universe.title,
      description: universe.description,
      href: `/authority/universes/${universe.master_id}`,
      attached_work_count: attached.length,
      attached_work_ids: attached,
      occupancy: universe.occupancy ?? "curated",
      withdrawable: universe.withdrawable ?? false,
    });
  }

  universeCards.sort((a, b) => OCCUPANCY_RANK[a.occupancy] - OCCUPANCY_RANK[b.occupancy]);

  return { standalone, universes: universeCards };
}

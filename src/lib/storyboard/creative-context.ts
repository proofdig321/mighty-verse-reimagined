/**
 * Creative context assembly for Storyboard generation.
 *
 * Assembles canonical Universe identity, documented participant/attribution
 * credits, work metadata, panel creative fields, Sentinel evidence, and
 * creator directive into a single structured CreativeContext object.
 *
 * This is context assembly — not autonomous creative authorship.
 *
 * Authority boundaries:
 *   Sentinel evidence  → labelled as observed evidence, not creative authority
 *   panel.characters   → free-text creative input, NOT canonical participant identity
 *   attribution_entry  → documented canonical credit, clearly distinguished
 *   creator directive  → authoritative creative instruction, never overwritten
 *
 * Provider neutrality:
 *   CreativeContext contains no Gemini/Veo-specific structures.
 *   Serialization to provider prompt format is handled separately in prompt-composer.ts.
 */

import { getServiceClient } from "@/lib/authority/validate";
import {
  displayNameFromIdentityRef,
  parseAttributionDisplayName,
} from "@/lib/participants/names";
import type { StoryboardPanelRecord, StoryboardWorkRecord, SentinelObservationRecord } from "./document";
import type { StoryboardReference } from "./document";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Canonical Universe identity — title and description only, no internal IDs. */
export type UniverseCreativeContext = {
  title: string;
  description: string | null;
};

/**
 * A documented participant/attribution credit on the canonical Universe.
 *
 * This is canonical identity from attribution_entry + participant + identity_link.
 * It is NOT derived from panel.characters (free text).
 * The distinction is enforced by the assembler — never conflate the two.
 */
export type DocumentedParticipant = {
  /** Display name resolved from identity_link or attribution contribution_description. */
  name: string;
  /** Attribution role from attribution_entry.role_type. */
  role: string;
  /** Contribution description from attribution_entry.contribution_description, if public. */
  description: string | null;
};

/** Work-level creative context from storyboard_work. */
export type WorkCreativeContext = {
  title: string;
  premise: string | null;
  tone: string | null;
  genre: string | null;
  audience: string | null;
  creative_intent: string | null;
};

/** Panel creative fields — all existing fields preserved. */
export type PanelCreativeContext = {
  title: string;
  description: string;
  narrative_purpose: string | null;
  action: string | null;
  dialogue: string | null;
  narration: string | null;
  camera: string | null;
  camera_movement: string | null;
  framing: string | null;
  lens_style: string | null;
  lighting: string | null;
  environment: string | null;
  /**
   * Free-text creative input from the curator.
   * NOT canonical participant identity.
   * Kept separate from documentedParticipants.
   */
  characters: string | null;
  mood: string | null;
  transition: string | null;
  references: StoryboardReference[];
};

/**
 * The assembled creative context for a single generation request.
 *
 * Flow:
 *   Universe → Work → Panel → CreativeContext → provider serialization → Gemini/Veo
 *
 * Sentinel evidence, documented participants, and creator directive each have
 * their own clearly labelled slot. They do not overwrite each other.
 */
export type CreativeContext = {
  /**
   * Canonical Universe identity.
   * null when the work has no universe_id or the Universe cannot be resolved.
   * Degrade gracefully — do not fabricate.
   */
  universe: UniverseCreativeContext | null;

  /**
   * Documented participants/attribution credits on the canonical Universe.
   * Empty array when no public attribution exists or Universe is unavailable.
   * These are canonical facts, not generated interpretations.
   */
  documentedParticipants: DocumentedParticipant[];

  /** Work-level creative context. */
  work: WorkCreativeContext;

  /** Panel creative fields. */
  panel: PanelCreativeContext;

  /**
   * Sentinel observation bound to this panel, if any.
   * Labelled as observed evidence — not creative authority.
   * null when no observation is bound.
   */
  sentinelEvidence: SentinelObservationRecord | null;

  /**
   * Creator directive — authoritative creative instruction.
   * Survives context assembly unchanged.
   * null when no directive is set.
   */
  creatorDirective: string | null;
};

// ---------------------------------------------------------------------------
// Result type — explicit success/failure, no silent fabrication
// ---------------------------------------------------------------------------

export type CreativeContextResult =
  | { ok: true; context: CreativeContext }
  | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type AttributionRow = {
  participant_id: string;
  role_type: string;
  contribution_description: string | null;
  public: boolean;
};

type IdentityLinkRow = {
  participant_id: string;
  identity_ref: string;
  active: boolean;
};

/**
 * Resolve display name for a participant.
 * Priority: identity_link display: prefix → attribution contribution_description parsing.
 * Returns null when no name can be resolved.
 */
function resolveDisplayName(
  participantId: string,
  links: IdentityLinkRow[],
  attributions: AttributionRow[],
): string | null {
  const participantLinks = links.filter(
    (link) => link.participant_id === participantId && link.active,
  );
  for (const link of participantLinks) {
    const name = displayNameFromIdentityRef(link.identity_ref);
    if (name) return name;
  }
  const participantAttrs = attributions.filter(
    (attr) => attr.participant_id === participantId,
  );
  return parseAttributionDisplayName(
    participantAttrs[0]?.contribution_description ?? null,
  );
}

/**
 * Load Universe title/description from work_presentation.
 * Returns null when the Universe cannot be resolved — never fabricates.
 */
async function loadUniverseContext(
  universeId: string,
): Promise<UniverseCreativeContext | null> {
  const svc = getServiceClient();

  const { data: master } = await svc
    .from("master")
    .select("master_id, canonical_type")
    .eq("master_id", universeId)
    .maybeSingle();

  if (!master || master.canonical_type !== "universe") return null;

  const { data: presentation } = await svc
    .from("work_presentation")
    .select("title, description")
    .eq("master_id", universeId)
    .maybeSingle();

  return {
    title: presentation?.title ?? "Untitled universe",
    description: presentation?.description ?? null,
  };
}

/**
 * Load documented participants for a Universe master.
 * Reads attribution_record → attribution_entry (public=true) → participant → identity_link.
 * Returns empty array when no public attribution exists.
 * Never fabricates participants.
 */
async function loadDocumentedParticipants(
  universeId: string,
): Promise<DocumentedParticipant[]> {
  const svc = getServiceClient();

  const { data: master } = await svc
    .from("master")
    .select("attribution_ref")
    .eq("master_id", universeId)
    .maybeSingle();

  if (!master?.attribution_ref) return [];

  const { data: entries } = await svc
    .from("attribution_entry")
    .select("participant_id, role_type, contribution_description, public")
    .eq("attribution_id", master.attribution_ref)
    .eq("public", true);

  if (!entries?.length) return [];

  const participantIds = [...new Set(entries.map((e) => e.participant_id))];

  const { data: links } = await svc
    .from("identity_link")
    .select("participant_id, identity_ref, active")
    .in("participant_id", participantIds)
    .eq("active", true);

  const resolvedLinks = (links ?? []) as IdentityLinkRow[];
  const resolvedEntries = entries as AttributionRow[];

  return resolvedEntries
    .map((entry): DocumentedParticipant | null => {
      const name = resolveDisplayName(
        entry.participant_id,
        resolvedLinks,
        resolvedEntries,
      );
      if (!name) return null;
      return {
        name,
        role: entry.role_type,
        description: entry.contribution_description ?? null,
      };
    })
    .filter((item): item is DocumentedParticipant => item !== null);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assemble the full creative context for a generation request.
 *
 * @param work  The storyboard work record (provides universe_id, title, premise, etc.)
 * @param panel The panel being generated
 * @param creatorDirective  Optional override directive from the generation request
 *
 * Returns CreativeContextResult — either ok with context, or not-ok with reason.
 * Never throws. Never fabricates canonical data.
 */
export async function assembleCreativeContext(
  work: StoryboardWorkRecord,
  panel: StoryboardPanelRecord,
  creatorDirective: string | null,
): Promise<CreativeContextResult> {
  try {
    // Universe context — optional, degrade gracefully
    const [universe, documentedParticipants] = work.universe_id
      ? await Promise.all([
          loadUniverseContext(work.universe_id),
          loadDocumentedParticipants(work.universe_id),
        ])
      : [null, [] as DocumentedParticipant[]];

    const workContext: WorkCreativeContext = {
      title: work.title,
      premise: work.premise ?? null,
      tone: work.tone ?? null,
      genre: work.genre ?? null,
      audience: work.audience ?? null,
      creative_intent: work.creative_intent ?? null,
    };

    const panelContext: PanelCreativeContext = {
      title: panel.title,
      description: panel.description,
      narrative_purpose: panel.narrative_purpose,
      action: panel.action,
      dialogue: panel.dialogue,
      narration: panel.narration,
      camera: panel.camera,
      camera_movement: panel.camera_movement,
      framing: panel.framing,
      lens_style: panel.lens_style,
      lighting: panel.lighting,
      environment: panel.environment,
      characters: panel.characters,
      mood: panel.mood,
      transition: panel.transition,
      references: panel.references,
    };

    const sentinelEvidence =
      panel.generation_metadata?.sentinel_observation ?? null;

    const directive =
      creatorDirective?.trim() ||
      panel.generation_metadata?.transformation_instruction?.trim() ||
      null;

    return {
      ok: true,
      context: {
        universe,
        documentedParticipants,
        work: workContext,
        panel: panelContext,
        sentinelEvidence,
        creatorDirective: directive,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, reason: `Creative context assembly failed: ${message}` };
  }
}

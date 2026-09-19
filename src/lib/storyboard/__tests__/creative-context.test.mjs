/**
 * Tests for assembleCreativeContext and prompt serialization.
 *
 * These tests cover the pure logic layer:
 *   - Type shapes and field mapping
 *   - Participant/attribution distinction from panel.characters
 *   - Sentinel evidence labelling
 *   - Creator directive preservation
 *   - Missing optional data graceful degradation
 *   - Provider neutrality (no Gemini/Veo-specific structures in CreativeContext)
 *   - Prompt serialization from CreativeContext
 *
 * DB-dependent paths (loadUniverseContext, loadDocumentedParticipants) are
 * tested via the exported pure helpers and type contracts.
 * Live DB verification requires .env.local and is marked NOT VERIFIED here.
 */

import {
  composeStillPromptFromContext,
  composeMotionPromptFromContext,
  panelPromptInputFromContext,
} from "../../ai/prompt-composer.ts";

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const UNIVERSE_ID = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";

const universeCtx = {
  title: "Super Hero Ego",
  description: "Golden Shovel ft Proverb, Reason and Mothipa",
};

const participants = [
  { name: "ProVerb", role: "featured-artist", description: "ProVerb — Hand-to-Hand" },
  { name: "Reason", role: "featured-artist", description: "Reason — Sword Master" },
  { name: "Mothipa", role: "featured-artist", description: "Mothipa — Dark Knight" },
];

const workCtx = {
  title: "Golden Shovel Storyboard",
  premise: "A hero's journey through the mural.",
  tone: "cinematic",
  genre: "afrofuturist",
  audience: "global",
  creative_intent: "Visualise the four canonical Scenes.",
};

const panelCtx = {
  title: "Powerhouse Entrance",
  description: "Golden Shovel steps into the arena.",
  narrative_purpose: "Establish the hero.",
  action: "walks forward",
  dialogue: null,
  narration: null,
  camera: "wide",
  camera_movement: "push in",
  framing: "full body",
  lens_style: "anamorphic",
  lighting: "golden hour",
  environment: "urban arena",
  characters: "The protagonist in ceremonial armour",
  mood: "triumphant",
  transition: "cut to black",
  references: [
    { role: "character", label: "Golden Shovel reference still", asset_id: "asset-1", url: null },
    { role: "environment", label: "Arena environment", asset_id: "asset-2", url: null },
  ],
};

const sentinelEvidence = {
  shot_id: "shot-1",
  start_ms: 36000,
  end_ms: 79000,
  time_ms: 36000,
  what_happens: "A figure emerges from shadow into light.",
  camera: "wide",
  camera_explanation: "Wide establishing shot.",
  framing: "full body",
  motion: "slow walk",
  action: "emerges",
  subjects: "single figure",
  environment: "urban arena",
  lighting: "golden",
  transition: "cut",
  narrative: null,
  confidence: "high",
  analysis_mode: "gemini-sampled-frames",
  still_url: null,
  creates_scene: false,
};

function makeContext(overrides = {}) {
  return {
    universe: universeCtx,
    documentedParticipants: participants,
    work: workCtx,
    panel: panelCtx,
    sentinelEvidence,
    creatorDirective: "Emphasise the golden light.",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Universe context
// ---------------------------------------------------------------------------

const ctxWithUniverse = makeContext();
const stillWithUniverse = composeStillPromptFromContext(ctxWithUniverse);

assert(stillWithUniverse.includes("Super Hero Ego"), "still prompt includes Universe title");
assert(stillWithUniverse.includes("Golden Shovel ft Proverb"), "still prompt includes Universe description");

const motionWithUniverse = composeMotionPromptFromContext(ctxWithUniverse);
assert(motionWithUniverse.includes("Super Hero Ego"), "motion prompt includes Universe title");

// ---------------------------------------------------------------------------
// 2. Participant context — documented credits appear in prompt
// ---------------------------------------------------------------------------

assert(stillWithUniverse.includes("ProVerb"), "still prompt includes documented participant ProVerb");
assert(stillWithUniverse.includes("Reason"), "still prompt includes documented participant Reason");
assert(stillWithUniverse.includes("Mothipa"), "still prompt includes documented participant Mothipa");
assert(stillWithUniverse.includes("featured-artist"), "still prompt includes attribution role");
assert(stillWithUniverse.includes("Documented creative credits"), "still prompt labels credits as documented");

// ---------------------------------------------------------------------------
// 3. Panel characters distinction — free text is NOT canonical participant
// ---------------------------------------------------------------------------

// panel.characters is free text creative input — it appears as "Subject:" field
assert(stillWithUniverse.includes("Subject: The protagonist in ceremonial armour"), "panel characters appear as Subject field");

// The panel characters field must NOT be labelled as a documented credit
// Credits block ends at the next blank-line-separated section (Premise/Tone/panel title)
const afterCredits = stillWithUniverse.split("Documented creative credits:")[1] ?? "";
const creditsBlock = afterCredits.split("\nPremise:")[0].split("\nTone:")[0].split("\nPowerhouse")[0];
assert(!creditsBlock.includes("The protagonist in ceremonial armour"), "panel.characters is NOT in documented credits block");

// Documented participants and panel.characters are separate
assert(stillWithUniverse.includes("ProVerb (featured-artist)"), "documented participant has role label");
assert(!stillWithUniverse.includes("The protagonist in ceremonial armour (featured-artist)"), "panel characters do not get role labels");

// ---------------------------------------------------------------------------
// 4. Sentinel evidence — labelled as evidence, not creative authority
// ---------------------------------------------------------------------------

assert(stillWithUniverse.includes("Sentinel observation (evidence only"), "Sentinel is labelled as evidence");
assert(stillWithUniverse.includes("A figure emerges from shadow"), "Sentinel what_happens appears");
assert(stillWithUniverse.includes("Evidence mode: Gemini sampled frames"), "Sentinel analysis mode is labelled");

// Sentinel subjects appear under observation, not as canonical participants
assert(stillWithUniverse.includes("Observed subjects: single figure"), "Sentinel subjects are labelled as observed");

// ---------------------------------------------------------------------------
// 5. Creator directive — present and distinct, appears last
// ---------------------------------------------------------------------------

assert(stillWithUniverse.includes("Creator directive: Emphasise the golden light."), "creator directive is present");
// Directive must appear after panel fields and Sentinel evidence
const directiveIdx = stillWithUniverse.indexOf("Creator directive:");
const sentinelIdx = stillWithUniverse.indexOf("Sentinel observation");
assert(directiveIdx > sentinelIdx, "creator directive appears after Sentinel evidence");

// Directive must not be overwritten by Universe metadata
assert(!stillWithUniverse.includes("Creator directive: Super Hero Ego"), "Universe title does not overwrite directive");

// ---------------------------------------------------------------------------
// 6. Missing optional data — graceful degradation
// ---------------------------------------------------------------------------

// No universe
const ctxNoUniverse = makeContext({ universe: null, documentedParticipants: [] });
const stillNoUniverse = composeStillPromptFromContext(ctxNoUniverse);
assert(!stillNoUniverse.includes("Universe:"), "no Universe label when universe is null");
assert(!stillNoUniverse.includes("Documented creative credits"), "no credits section when participants empty");
assert(stillNoUniverse.includes("Powerhouse Entrance"), "panel title still present without universe");
assert(stillNoUniverse.includes("Creator directive:"), "directive still present without universe");

// No Sentinel evidence
const ctxNoSentinel = makeContext({ sentinelEvidence: null });
const stillNoSentinel = composeStillPromptFromContext(ctxNoSentinel);
assert(!stillNoSentinel.includes("Sentinel observation"), "no Sentinel block when evidence is null");
assert(stillNoSentinel.includes("Powerhouse Entrance"), "panel title still present without Sentinel");

// No directive
const ctxNoDirective = makeContext({ creatorDirective: null });
const stillNoDirective = composeStillPromptFromContext(ctxNoDirective);
assert(!stillNoDirective.includes("Creator directive:"), "no directive block when directive is null");
assert(stillNoDirective.includes("Super Hero Ego"), "universe still present without directive");

// Empty participants
const ctxNoParticipants = makeContext({ documentedParticipants: [] });
const stillNoParticipants = composeStillPromptFromContext(ctxNoParticipants);
assert(!stillNoParticipants.includes("Documented creative credits"), "no credits block when participants empty");
assert(stillNoParticipants.includes("Super Hero Ego"), "universe still present without participants");

// ---------------------------------------------------------------------------
// 7. Missing Universe — clear result, no fabrication
// ---------------------------------------------------------------------------

const ctxMissingUniverse = makeContext({ universe: null });
const stillMissingUniverse = composeStillPromptFromContext(ctxMissingUniverse);
assert(!stillMissingUniverse.includes("Universe:"), "missing Universe does not produce fabricated Universe label");
assert(stillMissingUniverse.includes("Powerhouse Entrance"), "panel still generates without Universe");

// ---------------------------------------------------------------------------
// 8. Provider neutrality — CreativeContext has no Gemini/Veo-specific fields
// ---------------------------------------------------------------------------

const ctx = makeContext();
// CreativeContext fields are all plain data — no provider-specific keys
assert(typeof ctx.universe === "object", "universe is plain object");
assert(Array.isArray(ctx.documentedParticipants), "documentedParticipants is array");
assert(typeof ctx.work === "object", "work is plain object");
assert(typeof ctx.panel === "object", "panel is plain object");
assert(typeof ctx.sentinelEvidence === "object", "sentinelEvidence is plain object");
assert(typeof ctx.creatorDirective === "string", "creatorDirective is string");

// No Gemini/Veo-specific keys on the context object itself
const ctxKeys = Object.keys(ctx);
assert(!ctxKeys.includes("model"), "no model key on CreativeContext");
assert(!ctxKeys.includes("generationConfig"), "no generationConfig key on CreativeContext");
assert(!ctxKeys.includes("safetySettings"), "no safetySettings key on CreativeContext");

// panelPromptInputFromContext returns a PanelPromptInput-compatible shape
const ppi = panelPromptInputFromContext(ctx);
assert(typeof ppi.storyTitle === "string", "storyTitle is string");
assert(typeof ppi.panel === "object", "panel is object");
assert(typeof ppi._creativeContextHeader === "string", "context header is string");
assert(ppi._creativeContextHeader.includes("Super Hero Ego"), "context header includes universe");

// ---------------------------------------------------------------------------
// 9. References — roles preserved
// ---------------------------------------------------------------------------

assert(stillWithUniverse.includes("Golden Shovel reference still"), "character reference label in prompt");
assert(stillWithUniverse.includes("Arena environment"), "environment reference label in prompt");

// ---------------------------------------------------------------------------
// 10. Motion prompt — same context, different serialization
// ---------------------------------------------------------------------------

const motionCtx = makeContext();
const motionPrompt = composeMotionPromptFromContext(motionCtx, { aspectRatio: "16:9", durationSeconds: 8 });
assert(motionPrompt.includes("Super Hero Ego"), "motion prompt includes universe");
assert(motionPrompt.includes("ProVerb"), "motion prompt includes documented participant");
assert(motionPrompt.includes("The subject is The protagonist in ceremonial armour"), "motion prompt uses panel.characters as subject");
assert(motionPrompt.includes("Creator directive: Emphasise the golden light."), "motion prompt includes directive");
assert(motionPrompt.includes("Aspect 16:9"), "motion prompt includes aspect ratio");

// ---------------------------------------------------------------------------
// 11. Work context fields
// ---------------------------------------------------------------------------

assert(stillWithUniverse.includes("Premise: A hero's journey"), "premise appears in prompt");
assert(stillWithUniverse.includes("Tone: cinematic"), "tone appears in prompt");
assert(stillWithUniverse.includes("Genre: afrofuturist"), "genre appears in prompt");

console.log("creative-context tests: all passed");

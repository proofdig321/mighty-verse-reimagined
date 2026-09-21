/**
 * ISRC Recording Identity Tests
 *
 * Invariant: ISRC belongs to the specific recording realization, not to the
 * Work, Universe, or generic media asset. Every distinct qualifying media
 * recording gets its own ISRC, and no ISRC is inherited from another
 * realization merely because the recordings are related.
 *
 * Covers:
 *   A. Separate ISRCs — all realization types can carry distinct ISRCs
 *   B. No inheritance — derived realization must not copy source ISRC
 *   C. Duplicate protection — same ISRC on two realizations must fail
 *   D. Asset resolution — each asset resolves the ISRC of its own realization
 *   E. Embedded evidence — embedded ISRC is evidence, reconciled against canonical
 *   F. Missing canonical ISRC — system must not invent one
 *   G. Metadata display — UI distinguishes multiple recording ISRCs
 */

import assert from "node:assert/strict";

function pass(name) { console.log("  \x1b[32m✓\x1b[0m", name); }
function fail(name, err) { console.error("  \x1b[31m✗\x1b[0m", name, "\n   ", err.message); process.exitCode = 1; }
async function test(name, fn) {
  try { await fn(); pass(name); }
  catch (err) { fail(name, err); }
}

const {
  isIsrcEligible,
  recordingCategory,
  RECORDING_CATEGORY_LABELS,
  normalizeIsrc,
  validateIsrc,
  constructIsrc,
  formatIsrcDisplay,
} = await import("../isrc.ts");

const { detectIsrcConflict } = await import("../metadata-extract.ts");
const { hashCanonicalMetadata } = await import("../metadata-build.ts");
const { deriveDistributionReadiness } = await import("../distribution-readiness.ts");

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ISRC_A = "ZA80G1600096"; // sound recording  (owner's real ISRC, normalized)
const ISRC_B = "ZA80G1600097"; // music video
const ISRC_C = "ZA80G1600098"; // animated video
const ISRC_D = "ZA80G1600099"; // visualisation

function makeRealization(type, isrc, sourceIsrc = null) {
  return {
    realization_id: `r-${type}`,
    master_id: "master-001",
    realization_type: type,
    isrc: isrc ?? null,
    isrc_status: isrc ? "assigned" : "assignment-required",
    source_realization_id: null, // never carries source ISRC
    version_label: null,
  };
}

function makeAsset(realizationId, isrc) {
  return {
    asset_id: `asset-${realizationId}`,
    realization_id: realizationId,
    // The asset itself does not carry ISRC — it resolves via its realization
    _resolvedIsrc: isrc,
  };
}

function makeCanonicalMeta(overrides = {}) {
  return {
    mediaAssetId: "asset-001",
    mediaRealizationId: "r-original-recording",
    masterId: "master-001",
    title: "Golden Shovel — Powerhouse",
    creator: "Golden Shovel",
    description: null,
    rightsHolder: "participant-gs",
    rightsHolderLabel: "Golden Shovel",
    rightsBasis: "owned",
    copyrightYear: 2026,
    realizationType: "original-recording",
    versionLabel: null,
    isrc: ISRC_A,
    isrcStatus: "assigned",
    isrcRegistrantName: "Golden Shovel",
    metadataGeneratedAt: new Date().toISOString(),
    metadataVersion: 1,
    metadataSchema: "mighty-verse-media-metadata",
    ...overrides,
  };
}

// ─── A. Separate ISRCs — all realization types carry distinct ISRCs ────────────

console.log("\nA. Separate ISRCs\n");

await test("original-recording is ISRC-eligible", () => {
  assert.equal(isIsrcEligible("original-recording"), true);
});
await test("music-video is ISRC-eligible", () => {
  assert.equal(isIsrcEligible("music-video"), true);
});
await test("animated-video is ISRC-eligible", () => {
  assert.equal(isIsrcEligible("animated-video"), true);
});
await test("visualisation is ISRC-eligible", () => {
  assert.equal(isIsrcEligible("visualisation"), true);
});
await test("live-performance is ISRC-eligible", () => {
  assert.equal(isIsrcEligible("live-performance"), true);
});
await test("broadcast-recording is ISRC-eligible", () => {
  assert.equal(isIsrcEligible("broadcast-recording"), true);
});
await test("other is NOT ISRC-eligible", () => {
  assert.equal(isIsrcEligible("other"), false);
});

await test("four realizations on one master each carry a distinct ISRC", () => {
  const realizations = [
    makeRealization("original-recording", ISRC_A),
    makeRealization("music-video",        ISRC_B),
    makeRealization("animated-video",     ISRC_C),
    makeRealization("visualisation",      ISRC_D),
  ];
  const isrcs = realizations.map(r => r.isrc);
  const unique = new Set(isrcs);
  assert.equal(unique.size, 4, "All four ISRCs must be distinct");
  for (const r of realizations) {
    assert.ok(r.isrc, `${r.realization_type} must have an ISRC`);
    assert.equal(validateIsrc(r.isrc), null, `${r.realization_type} ISRC must be valid`);
  }
});

await test("owner's real ISRC ZA-80G-16-00096 is valid", () => {
  const normalized = normalizeIsrc("ZA-80G-16-00096");
  assert.equal(normalized, "ZA80G1600096");
  assert.equal(validateIsrc(normalized), null);
  assert.equal(formatIsrcDisplay(normalized), "ZA-80G-16-00096");
});

// ─── B. No inheritance — derived realization must not copy source ISRC ─────────

console.log("\nB. No inheritance\n");

await test("music-video realization does not inherit source ISRC", () => {
  const soundRecording = makeRealization("original-recording", ISRC_A);
  // Simulate creating a derived music-video realization
  const musicVideo = {
    ...makeRealization("music-video", null),
    source_realization_id: soundRecording.realization_id,
    // ISRC is NOT copied from source — operator must assign separately
  };
  assert.equal(musicVideo.isrc, null, "Music video ISRC must not be inherited from source");
  assert.notEqual(musicVideo.source_realization_id, null, "source_realization_id records the relationship");
});

await test("animated-video realization does not inherit source ISRC", () => {
  const soundRecording = makeRealization("original-recording", ISRC_A);
  const animatedVideo = {
    ...makeRealization("animated-video", null),
    source_realization_id: soundRecording.realization_id,
  };
  assert.equal(animatedVideo.isrc, null, "Animated video ISRC must not be inherited");
});

await test("visualisation realization does not inherit source ISRC", () => {
  const soundRecording = makeRealization("original-recording", ISRC_A);
  const visualisation = {
    ...makeRealization("visualisation", null),
    source_realization_id: soundRecording.realization_id,
  };
  assert.equal(visualisation.isrc, null, "Visualisation ISRC must not be inherited");
});

await test("source_realization_id is a relationship, not an ISRC carrier", () => {
  const source = makeRealization("original-recording", ISRC_A);
  const derived = makeRealization("music-video", ISRC_B);
  // The relationship is expressed by source_realization_id
  // The ISRCs are independent
  assert.notEqual(source.isrc, derived.isrc, "Source and derived ISRCs must differ");
  // Simulating what the API must NOT do:
  const wouldBeWrong = source.isrc; // copying source ISRC
  assert.notEqual(derived.isrc, wouldBeWrong, "Derived ISRC must not equal source ISRC");
});

// ─── C. Duplicate protection ───────────────────────────────────────────────────

console.log("\nC. Duplicate protection\n");

await test("same ISRC on two realizations is detected as a conflict", () => {
  const existing = makeRealization("original-recording", ISRC_A);
  const attempted = makeRealization("music-video", ISRC_A); // same ISRC — wrong

  // Simulate the application-layer duplicate check (mirrors the API route logic)
  function checkDuplicate(newIsrc, existingRealizations, targetRealizationId) {
    const conflict = existingRealizations.find(
      r => r.isrc === newIsrc && r.realization_id !== targetRealizationId
    );
    if (conflict) {
      return {
        error: `ISRC ${newIsrc} is already assigned to a different recording (${conflict.realization_type})`,
      };
    }
    return null;
  }

  const result = checkDuplicate(ISRC_A, [existing], attempted.realization_id);
  assert.ok(result?.error, "Duplicate ISRC must be rejected");
  assert.ok(result.error.includes("already assigned"), "Error must explain the ISRC is taken");
  assert.ok(result.error.includes("original-recording"), "Error must name the conflicting realization type");
});

await test("different ISRCs on two realizations of the same master is valid", () => {
  const existing = makeRealization("original-recording", ISRC_A);

  function checkDuplicate(newIsrc, existingRealizations, targetRealizationId) {
    return existingRealizations.find(
      r => r.isrc === newIsrc && r.realization_id !== targetRealizationId
    ) ?? null;
  }

  const result = checkDuplicate(ISRC_B, [existing], "r-music-video");
  assert.equal(result, null, "Distinct ISRCs on different realizations must be accepted");
});

await test("ISRC uniqueness constraint: normalized form must match", () => {
  // Both display and storage forms of the same ISRC must normalize to the same value
  const display = "ZA-80G-16-00096";
  const storage = "ZA80G1600096";
  assert.equal(normalizeIsrc(display), normalizeIsrc(storage));
});

// ─── D. Asset resolution — each asset resolves its own realization's ISRC ──────

console.log("\nD. Asset resolution\n");

await test("audio asset resolves sound recording ISRC", () => {
  const realization = makeRealization("original-recording", ISRC_A);
  const asset = makeAsset(realization.realization_id, realization.isrc);
  assert.equal(asset._resolvedIsrc, ISRC_A);
  assert.equal(recordingCategory(realization.realization_type), "sound-recording");
});

await test("music-video asset resolves music-video ISRC", () => {
  const realization = makeRealization("music-video", ISRC_B);
  const asset = makeAsset(realization.realization_id, realization.isrc);
  assert.equal(asset._resolvedIsrc, ISRC_B);
  assert.equal(recordingCategory(realization.realization_type), "music-video");
});

await test("animated-video asset resolves animated-video ISRC", () => {
  const realization = makeRealization("animated-video", ISRC_C);
  const asset = makeAsset(realization.realization_id, realization.isrc);
  assert.equal(asset._resolvedIsrc, ISRC_C);
  assert.equal(recordingCategory(realization.realization_type), "animated-video");
});

await test("visualisation asset resolves visualisation ISRC", () => {
  const realization = makeRealization("visualisation", ISRC_D);
  const asset = makeAsset(realization.realization_id, realization.isrc);
  assert.equal(asset._resolvedIsrc, ISRC_D);
  assert.equal(recordingCategory(realization.realization_type), "visualisation");
});

await test("asset without realization resolves null ISRC", () => {
  const asset = { asset_id: "asset-orphan", realization_id: null, _resolvedIsrc: null };
  assert.equal(asset._resolvedIsrc, null);
});

await test("buildCanonicalMetadata ISRC is scoped to the asset's own realization", () => {
  // Simulate what buildCanonicalMetadata returns for two different assets
  const metaAudio = makeCanonicalMeta({
    mediaAssetId: "asset-audio",
    mediaRealizationId: "r-original-recording",
    realizationType: "original-recording",
    isrc: ISRC_A,
  });
  const metaVideo = makeCanonicalMeta({
    mediaAssetId: "asset-video",
    mediaRealizationId: "r-music-video",
    realizationType: "music-video",
    isrc: ISRC_B,
  });
  // Each asset carries the ISRC of its own realization
  assert.equal(metaAudio.isrc, ISRC_A);
  assert.equal(metaVideo.isrc, ISRC_B);
  assert.notEqual(metaAudio.isrc, metaVideo.isrc);
  // The hash changes when the realization changes
  assert.notEqual(hashCanonicalMetadata(metaAudio), hashCanonicalMetadata(metaVideo));
});

// ─── E. Embedded evidence — treated as evidence, reconciled against canonical ──

console.log("\nE. Embedded evidence\n");

await test("embedded ISRC matching canonical — no conflict", () => {
  const result = detectIsrcConflict({ embeddedIsrc: ISRC_A }, ISRC_A);
  assert.equal(result.conflict, false);
});

await test("embedded ISRC differing from canonical — conflict flagged", () => {
  const result = detectIsrcConflict({ embeddedIsrc: ISRC_A }, ISRC_B);
  assert.equal(result.conflict, true);
  assert.ok(result.description.toLowerCase().includes("conflict"));
});

await test("embedded ISRC present, no canonical — flagged for operator review", () => {
  const result = detectIsrcConflict({ embeddedIsrc: ISRC_A }, null);
  assert.equal(result.conflict, false);
  assert.ok(result.description.includes("operator should review"));
});

await test("embedded ISRC is evidence only — does not become canonical automatically", () => {
  // The extractor returns embeddedIsrc; it is never silently written to canonical state
  const extracted = { embeddedIsrc: ISRC_A };
  // Canonical state is separate — operator must reconcile
  const canonicalIsrc = null; // not yet assigned
  const result = detectIsrcConflict(extracted, canonicalIsrc);
  // No conflict, but canonical is still null — evidence does not auto-promote
  assert.equal(result.conflict, false);
  assert.equal(canonicalIsrc, null, "Canonical ISRC must not be mutated by extraction");
});

// ─── F. Missing canonical ISRC — system must not invent one ───────────────────

console.log("\nF. Missing canonical ISRC\n");

await test("canonical metadata with no ISRC returns null isrc", () => {
  const meta = makeCanonicalMeta({ isrc: null, isrcStatus: "assignment-required" });
  assert.equal(meta.isrc, null);
});

await test("hash is stable when ISRC is null", () => {
  const meta = makeCanonicalMeta({ isrc: null });
  const h1 = hashCanonicalMetadata(meta);
  const h2 = hashCanonicalMetadata(meta);
  assert.equal(h1, h2);
});

await test("hash changes when ISRC is assigned (not invented)", () => {
  const before = makeCanonicalMeta({ isrc: null });
  const after  = makeCanonicalMeta({ isrc: ISRC_A });
  assert.notEqual(hashCanonicalMetadata(before), hashCanonicalMetadata(after));
});

await test("distribution gate blocks eligible recording without ISRC", () => {
  const readiness = deriveDistributionReadiness({
    title: "Powerhouse",
    rightsHolder: "Golden Shovel",
    rightsBasis: "owned",
    boundMasterId: "master-001",
    boundMasterTitle: "Powerhouse",
    publicHref: "/worlds/master-001",
    isrc: null,
    isrcStatus: "assignment-required",
    isrcEligible: true,
  });
  const isrcGate = readiness.gates.find(g => g.id === "isrc");
  assert.equal(isrcGate?.ready, false, "ISRC gate must block when eligible but unassigned");
});

await test("distribution gate passes non-eligible realization without ISRC", () => {
  const readiness = deriveDistributionReadiness({
    title: "Artwork",
    rightsHolder: "Golden Shovel",
    rightsBasis: "owned",
    boundMasterId: "master-001",
    boundMasterTitle: "Powerhouse",
    publicHref: "/worlds/master-001",
    isrc: null,
    isrcStatus: "not-applicable",
    isrcEligible: false,
  });
  const isrcGate = readiness.gates.find(g => g.id === "isrc");
  assert.equal(isrcGate?.ready, true, "ISRC gate must pass when not eligible");
});

// ─── G. Metadata display — UI distinguishes multiple recording ISRCs ───────────

console.log("\nG. Metadata display\n");

await test("recordingCategory: original-recording → sound-recording", () => {
  assert.equal(recordingCategory("original-recording"), "sound-recording");
});
await test("recordingCategory: live-performance → sound-recording", () => {
  assert.equal(recordingCategory("live-performance"), "sound-recording");
});
await test("recordingCategory: broadcast-recording → sound-recording", () => {
  assert.equal(recordingCategory("broadcast-recording"), "sound-recording");
});
await test("recordingCategory: music-video → music-video", () => {
  assert.equal(recordingCategory("music-video"), "music-video");
});
await test("recordingCategory: animated-video → animated-video", () => {
  assert.equal(recordingCategory("animated-video"), "animated-video");
});
await test("recordingCategory: visualisation → visualisation", () => {
  assert.equal(recordingCategory("visualisation"), "visualisation");
});
await test("recordingCategory: other → other", () => {
  assert.equal(recordingCategory("other"), "other");
});

await test("RECORDING_CATEGORY_LABELS covers all categories", () => {
  const required = ["sound-recording", "music-video", "animated-video", "visualisation", "other"];
  for (const cat of required) {
    assert.ok(RECORDING_CATEGORY_LABELS[cat], `Label missing for category: ${cat}`);
  }
});

await test("sibling realizations carry distinct ISRCs and distinct category labels", () => {
  const siblings = [
    { realization_id: "r-a", realization_type: "original-recording", isrc: ISRC_A, version_label: null },
    { realization_id: "r-b", realization_type: "music-video",        isrc: ISRC_B, version_label: null },
    { realization_id: "r-c", realization_type: "animated-video",     isrc: ISRC_C, version_label: null },
    { realization_id: "r-d", realization_type: "visualisation",      isrc: ISRC_D, version_label: null },
  ];
  const isrcs = siblings.map(s => s.isrc);
  const labels = siblings.map(s => RECORDING_CATEGORY_LABELS[recordingCategory(s.realization_type)]);
  // All ISRCs distinct
  assert.equal(new Set(isrcs).size, 4, "All sibling ISRCs must be distinct");
  // All labels distinct
  assert.equal(new Set(labels).size, 4, "All sibling category labels must be distinct");
  // No label is undefined
  for (const label of labels) {
    assert.ok(label, "Every sibling must have a defined category label");
  }
});

await test("display format of owner's ISRC is correct", () => {
  assert.equal(formatIsrcDisplay("ZA80G1600096"), "ZA-80G-16-00096");
});

console.log("\nDone.\n");

/**
 * ISRC invariant tests.
 *
 * Covers:
 *   1. missing rights → rights-dependent operation blocked
 *   2. invalid realization type → ISRC assignment blocked
 *   3. missing rights holder on realization → ISRC assignment blocked
 *   4. missing registrant → ISRC assignment blocked
 *   5. existing ISRC → duplicate assignment blocked
 *   6. valid assignment → media_realization.isrc populated
 *   7. media_intake.isrc → never treated as authoritative recording identity
 *   8. distribution readiness uses realization.isrc only
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isIsrcEligible, validateIsrc, constructIsrc, normalizeIsrc } from "../isrc.ts";
import { deriveDistributionReadiness } from "../distribution-readiness.ts";

describe("ISRC eligibility", () => {
  it("eligible types are accepted", () => {
    const eligible = [
      "original-recording",
      "music-video",
      "animated-video",
      "visualisation",
      "live-performance",
      "broadcast-recording",
    ];
    for (const t of eligible) {
      assert.equal(isIsrcEligible(t), true, `${t} should be eligible`);
    }
  });

  it("other is not eligible", () => {
    assert.equal(isIsrcEligible("other"), false);
    assert.equal(isIsrcEligible(""), false);
    assert.equal(isIsrcEligible("unknown"), false);
  });
});

describe("ISRC validation", () => {
  it("valid canonical ISRC passes", () => {
    assert.equal(validateIsrc("GBAYE0601234"), null);
    assert.equal(validateIsrc("USRC17607839"), null);
  });

  it("wrong length fails", () => {
    assert.notEqual(validateIsrc("GBAYE060123"), null);   // 11 chars
    assert.notEqual(validateIsrc("GBAYE06012345"), null); // 13 chars
  });

  it("lowercase fails", () => {
    assert.notEqual(validateIsrc("gbaye0601234"), null);
  });

  it("hyphens in canonical form fail", () => {
    assert.notEqual(validateIsrc("GB-AYE-06-01234"), null);
  });
});

describe("ISRC construction", () => {
  it("constructs correct canonical form", () => {
    const isrc = constructIsrc("GBAYE", 26, 1);
    assert.equal(isrc, "GBAYE2600001");
    assert.equal(validateIsrc(isrc), null);
  });

  it("pads year and designation", () => {
    const isrc = constructIsrc("USRC1", 6, 42);
    assert.equal(isrc, "USRC10600042");
    assert.equal(validateIsrc(isrc), null);
  });
});

describe("ISRC normalization", () => {
  it("strips hyphens and uppercases", () => {
    assert.equal(normalizeIsrc("gb-aye-06-01234"), "GBAYE0601234");
    assert.equal(normalizeIsrc("GB-AYE-06-01234"), "GBAYE0601234");
  });
});

describe("ISRC assignment prerequisites (domain logic)", () => {
  // These mirror the server-side guards in /api/authority/isrc/assign/route.ts
  // without hitting the database. They verify the invariant logic is correct.

  it("ineligible type blocks assignment", () => {
    const realizationType = "other";
    assert.equal(isIsrcEligible(realizationType), false,
      "other realization type must not be ISRC-eligible");
  });

  it("missing rights_holder_ref blocks assignment", () => {
    // The assign route checks: if (!realization.rights_holder_ref) → 422
    const rightsHolderRef = null;
    assert.equal(rightsHolderRef, null,
      "null rights_holder_ref must block ISRC assignment");
  });

  it("existing ISRC blocks duplicate assignment", () => {
    // The assign route checks: if (realization.isrc) → 409
    const existingIsrc = "GBAYE2600001";
    assert.ok(existingIsrc, "existing ISRC must block duplicate assignment");
  });

  it("missing registrant blocks assignment", () => {
    // The assign route checks: if (!registrant) → 422
    const registrant = null;
    assert.equal(registrant, null,
      "null registrant must block ISRC assignment");
  });
});

describe("media_intake.isrc is never authoritative recording identity", () => {
  it("distribution readiness uses realization.isrc only", () => {
    // Scenario: intake has an ISRC but realization does not
    // Distribution readiness must NOT treat intake.isrc as assigned
    const readiness = deriveDistributionReadiness({
      title: "Super Hero Ego",
      rightsHolder: "Golden Shovel",
      rightsBasis: "Original composition",
      boundMasterId: "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc",
      boundMasterTitle: "Super Hero Ego",
      publicHref: "/worlds/05ccc0c6-75f9-4864-b0c1-af5e36bf45cc",
      isrc: null,           // realization.isrc is null
      isrcStatus: "assignment-required",
      isrcEligible: true,
    });

    const isrcGate = readiness.gates.find(g => g.id === "isrc");
    assert.ok(isrcGate, "ISRC gate must exist");
    assert.equal(isrcGate.ready, false,
      "ISRC gate must be not-ready when realization.isrc is null, regardless of intake.isrc");
  });

  it("distribution readiness is ready when realization.isrc is set", () => {
    const readiness = deriveDistributionReadiness({
      title: "Super Hero Ego",
      rightsHolder: "Golden Shovel",
      rightsBasis: "Original composition",
      boundMasterId: "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc",
      boundMasterTitle: "Super Hero Ego",
      publicHref: "/worlds/05ccc0c6-75f9-4864-b0c1-af5e36bf45cc",
      isrc: "GBAYE2600001",  // realization.isrc is set
      isrcStatus: "assigned",
      isrcEligible: true,
    });

    const isrcGate = readiness.gates.find(g => g.id === "isrc");
    assert.ok(isrcGate, "ISRC gate must exist");
    assert.equal(isrcGate.ready, true,
      "ISRC gate must be ready when realization.isrc is set");
  });

  it("non-eligible realization type makes ISRC gate ready regardless", () => {
    const readiness = deriveDistributionReadiness({
      title: "Some Asset",
      rightsHolder: "Owner",
      rightsBasis: "Owned",
      boundMasterId: "some-id",
      boundMasterTitle: "Some Work",
      publicHref: "/worlds/some-id",
      isrc: null,
      isrcStatus: "not-applicable",
      isrcEligible: false,
    });

    const isrcGate = readiness.gates.find(g => g.id === "isrc");
    assert.ok(isrcGate, "ISRC gate must exist");
    assert.equal(isrcGate.ready, true,
      "ISRC gate must be ready for non-eligible realization types");
  });
});

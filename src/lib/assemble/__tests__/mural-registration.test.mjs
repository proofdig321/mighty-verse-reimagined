import {
  decideMuralRegistration,
  resolveMuralTitle,
} from "../mural-registration";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const UNIVERSE_ID = "f11c3aba-2dcb-473a-b982-1b7442bd32b3";
const SHE_UNIVERSE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
const MURAL_ID = "a75ae8af-7b48-4b67-8392-d89447bae370";
const PROJECTION_ID = "2e68a8d6-6b15-4d16-a0d9-2ea290815f21";

const invalid = decideMuralRegistration({
  universeId: "not-a-uuid",
  universeCanonicalType: "universe",
  existingMuralId: null,
  existingProjectionId: null,
});
assert(invalid.action === "reject" && invalid.reason === "invalid_universe", "invalid universe id is rejected");

const missing = decideMuralRegistration({
  universeId: UNIVERSE_ID,
  universeCanonicalType: null,
  existingMuralId: null,
  existingProjectionId: null,
});
assert(missing.action === "reject" && missing.reason === "not_found", "missing universe is rejected");

const notUniverse = decideMuralRegistration({
  universeId: UNIVERSE_ID,
  universeCanonicalType: "mural",
  existingMuralId: null,
  existingProjectionId: null,
});
assert(notUniverse.action === "reject" && notUniverse.reason === "not_universe", "non-universe master is rejected");

const register = decideMuralRegistration({
  universeId: UNIVERSE_ID,
  universeCanonicalType: "universe",
  existingMuralId: null,
  existingProjectionId: null,
});
assert(register.action === "register", "Universe without Mural can register");

const complete = decideMuralRegistration({
  universeId: UNIVERSE_ID,
  universeCanonicalType: "universe",
  existingMuralId: MURAL_ID,
  existingProjectionId: null,
});
assert(complete.action === "complete_projection" && complete.muralId === MURAL_ID, "missing projection is completed without a second Mural");

const already = decideMuralRegistration({
  universeId: SHE_UNIVERSE,
  universeCanonicalType: "universe",
  existingMuralId: MURAL_ID,
  existingProjectionId: PROJECTION_ID,
});
assert(
  already.action === "already_registered" &&
    already.muralId === MURAL_ID &&
    already.projectionId === PROJECTION_ID,
  "Super Hero Ego mural registration is idempotent",
);

assert(
  resolveMuralTitle({ requestedTitle: "  Opening Mural  ", universeTitle: "Super Hero Ego" }) === "Opening Mural",
  "explicit title wins",
);
assert(
  resolveMuralTitle({ requestedTitle: "   ", universeTitle: "Super Hero Ego" }) === "Super Hero Ego",
  "universe title is the fallback",
);
assert(
  resolveMuralTitle({ requestedTitle: null, universeTitle: null }) === "Mural",
  "untitled Universe uses a generic Mural title",
);

console.log("Assemble mural registration tests: all passed");

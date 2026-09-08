import { decideCreativeMomentIdentity } from "../creative-moment-identity";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const UNIVERSE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
const OTHER_UNIVERSE = "f11c3aba-2dcb-473a-b982-1b7442bd32b3";
const PROVERB = "3b0de6b4-2ca0-43c0-8561-7dc1c0697435";
const POWERHOUSE = "4790c7cf-bb19-4a01-a243-e5c3eb680555";

const proverb = { master_id: PROVERB, canonical_type: "creative-moment", parent_master_id: UNIVERSE };
const otherMoment = { master_id: "11111111-1111-4111-8111-111111111111", canonical_type: "creative-moment", parent_master_id: OTHER_UNIVERSE };
const scene = { master_id: POWERHOUSE, canonical_type: "scene", parent_master_id: "a75ae8af-7b48-4b67-8392-d89447bae370" };

const named = decideCreativeMomentIdentity({
  universe_id: UNIVERSE,
  moment_master_id: PROVERB,
  title: "  Proverb  ",
  description: "  Contributor presence  ",
  moment: proverb,
});
assert(named.ok && named.action === "update_identity", "an existing Creative Moment can be named");
assert(named.identity.title === "Proverb", "title is trimmed");
assert(named.identity.description === "Contributor presence", "description is trimmed");
assert(named.creates_projection === false && named.creates_media === false, "identity does not create playback or media");
assert(named.touches_presence === false, "identity does not change presence");

const blank = decideCreativeMomentIdentity({
  universe_id: UNIVERSE,
  moment_master_id: PROVERB,
  title: "   ",
  moment: proverb,
});
assert(!blank.ok && blank.code === "invalid_identity", "blank title is rejected");

const notMoment = decideCreativeMomentIdentity({
  universe_id: UNIVERSE,
  moment_master_id: POWERHOUSE,
  title: "Proverb",
  moment: scene,
});
assert(!notMoment.ok && notMoment.code === "not_creative_moment", "Scenes cannot be named as Creative Moments");

const otherUniverse = decideCreativeMomentIdentity({
  universe_id: UNIVERSE,
  moment_master_id: otherMoment.master_id,
  title: "Proverb",
  moment: otherMoment,
});
assert(!otherUniverse.ok && otherUniverse.code === "wrong_universe", "Creative Moment from another Universe is rejected");

const missing = decideCreativeMomentIdentity({
  title: "Proverb",
  moment: null,
});
assert(!missing.ok && missing.code === "missing_ids", "missing Creative Moment is rejected");

console.log("Assemble Creative Moment identity tests: all passed");

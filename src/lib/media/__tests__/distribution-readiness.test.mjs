import { deriveDistributionReadiness } from "../distribution-readiness";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const incomplete = deriveDistributionReadiness({
  title: null,
  rightsHolder: null,
  rightsBasis: null,
  boundMasterId: null,
  boundMasterTitle: null,
  publicHref: null,
  isrc: null,
  isrcStatus: null,
  isrcEligible: false,
});
assert(incomplete.readyForCanonicalHome === false, "unbound untitled media is not distribution-ready");
assert(incomplete.gates.find((gate) => gate.id === "isrc")?.ready === true, "animation without ISRC eligibility is not blocked");
assert(incomplete.external.every((item) => item.live === false), "YouTube/Spotify/Vimeo adapters stay unclaimed");

const fr = deriveDistributionReadiness({
  title: "Father Raymond - Golden Shovel feat Reverb 360",
  rightsHolder: "Golden Shovel",
  rightsBasis: "Owns song and animation",
  boundMasterId: "14938419-9477-431a-be04-511b1e205bbd",
  boundMasterTitle: "Father Raymond",
  publicHref: "/worlds/e22e080c-715c-4045-ba82-20474d25b2e0",
  isrc: null,
  isrcStatus: "not-applicable",
  isrcEligible: false,
  identityHref: "/authority/universes/e22e080c-715c-4045-ba82-20474d25b2e0/identity",
  rightsHref: "/authority/14938419-9477-431a-be04-511b1e205bbd",
});
assert(fr.readyForCanonicalHome === true, "bound mural with identity and rights is the Mighty Verse home");
assert(fr.gates.find((gate) => gate.id === "canonical_bind")?.href?.includes("14938419"), "bind gate opens the mural record");
assert(fr.note.includes("canonical distribution home"), "copy states Mighty Verse is the home, not a YouTube mirror");

const music = deriveDistributionReadiness({
  title: "Super Hero Ego",
  rightsHolder: "Golden Shovel",
  rightsBasis: "Master recording",
  boundMasterId: "a75ae8af-7b48-4b67-8392-d89447bae370",
  boundMasterTitle: "Super Hero Ego",
  publicHref: "/worlds/05ccc0c6-75f9-4864-b0c1-af5e36bf45cc",
  isrc: null,
  isrcStatus: "assignment-required",
  isrcEligible: true,
});
assert(music.gates.find((gate) => gate.id === "isrc")?.ready === false, "eligible recording without ISRC is gated");
assert(music.readyForCanonicalHome === true, "ISRC gates music-platform projections, not the Mighty Verse home");

console.log("distribution-readiness.test.mjs: ok");

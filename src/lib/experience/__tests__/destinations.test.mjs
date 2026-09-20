import { UNIVERSE_LABEL, ENTER_2_5D_LABEL, HOLOGRAPHIC_EXPERIENCE_LABEL, public2_5dHref, publicHolographicHref, publicWorldHref } from "../destinations";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const SHE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
assert(UNIVERSE_LABEL === "Universe", "Universe label is Universe");
assert(ENTER_2_5D_LABEL === "2.5D", "2.5D entry CTA is 2.5D");
assert(HOLOGRAPHIC_EXPERIENCE_LABEL === "Holographic Experience", "holographic destination is explicit");
assert(publicWorldHref(SHE) === `/worlds/${SHE}`, "Universe destination is /worlds/[id]");
assert(public2_5dHref(SHE) === `/worlds/${SHE}/2.5d`, "2.5D destination is /worlds/[id]/2.5d");
assert(publicHolographicHref(SHE) === `/worlds/${SHE}/holographic`, "Holographic Experience stays on /holographic");
assert(publicWorldHref(SHE) !== public2_5dHref(SHE), "Universe and 2.5D destinations are distinct");
assert(public2_5dHref(SHE) !== publicHolographicHref(SHE), "2.5D and Holographic destinations are distinct");
assert(publicWorldHref(SHE) !== publicHolographicHref(SHE), "Universe and Holographic destinations are distinct");

console.log("Experience destination tests: all passed");

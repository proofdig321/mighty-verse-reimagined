import { ENTER_2_5D_LABEL, HOLOGRAPHIC_EXPERIENCE_LABEL, publicHolographicHref, publicWorldHref } from "../destinations";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const SHE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
assert(ENTER_2_5D_LABEL === "Enter 2.5D", "Universe entry CTA is Enter 2.5D");
assert(HOLOGRAPHIC_EXPERIENCE_LABEL === "Holographic Experience", "holographic destination is explicit");
assert(publicWorldHref(SHE) === `/worlds/${SHE}`, "2.5D destination is the Universe world");
assert(publicHolographicHref(SHE) === `/worlds/${SHE}/holographic`, "Holographic Experience stays on /holographic");
assert(publicWorldHref(SHE) !== publicHolographicHref(SHE), "2.5D and holographic destinations stay distinct");

console.log("Experience destination tests: all passed");

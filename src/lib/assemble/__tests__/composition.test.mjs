import {
  sceneOrdinal,
  sceneShortTitle,
  sceneStillUrl,
  sharedCreativeMomentIds,
} from "../composition";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(sceneOrdinal(0) === "01", "first scene ordinal");
assert(sceneOrdinal(3) === "04", "fourth scene ordinal");
assert(sceneShortTitle("Golden Shovel — Powerhouse") === "Powerhouse", "short title after em dash");
assert(sceneShortTitle("Powerhouse") === "Powerhouse", "short title without dash stays intact");
assert(sceneShortTitle(null) === null, "missing title");

const shared = sharedCreativeMomentIds([
  { creative_moment_id: "proverb" },
  { creative_moment_id: "mothipa" },
  { creative_moment_id: "proverb" },
  { creative_moment_id: "reason" },
]);
assert(shared.has("proverb") && shared.size === 1, "only shared Creative Moments are flagged");

const sharedFromLists = sharedCreativeMomentIds([
  { creative_moments: [{ master_id: "proverb" }, { master_id: "reason" }] },
  { creative_moments: [{ master_id: "mothipa" }] },
  { creative_moments: [{ master_id: "proverb" }] },
]);
assert(sharedFromLists.has("proverb") && !sharedFromLists.has("reason"), "multiple presence on one Scene still flags only shared Moments");

assert(
  sceneStillUrl({ provider: "mux", storage_ref: "seed:placeholder:x", start_ms: 36000 }) === null,
  "placeholder storage is not a still",
);
assert(sceneStillUrl({ provider: "mux", storage_ref: "", start_ms: 36000 }) === null, "empty storage is not a still");

const still = sceneStillUrl({
  provider: "mux",
  storage_ref: "JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4",
  start_ms: 36000,
});
assert(still && still.provider === "mux" && still.timeSec === 36, "Mux still uses scene start time");

console.log("Assemble composition helpers: all passed");

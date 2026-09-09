import {
  nextCreateWorkStep,
  createWorkContinuations,
  isProtectedCanonicalId,
  SUPER_HERO_EGO_UNIVERSE,
  SUPER_HERO_EGO_MURAL,
  SUPER_HERO_EGO_MUX_ASSET,
} from "../create-work-progress";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(nextCreateWorkStep(null, true) === "register_master", "fresh create starts at master");

const afterMaster = {
  workType: "universe",
  title: "Father Raymond - Golden Shovel feat Reverb 360",
  masterId: "e22e080c-715c-4045-ba82-20474d25b2e0",
};
assert(nextCreateWorkStep(afterMaster, true) === "authorise_state", "retry with master does not register again");
assert(nextCreateWorkStep(afterMaster, true) !== "register_master", "retry never duplicates the Universe");

const afterProjection = {
  ...afterMaster,
  stateId: "5fbe0ec6-0000-4000-8000-000000000001",
  projectionId: "296456b4-0000-4000-8000-000000000001",
};
assert(nextCreateWorkStep(afterProjection, true) === "create_session", "resume continues at upload session");
assert(nextCreateWorkStep(afterProjection, false) === "complete", "work without media is complete after projection");

const afterUpload = {
  ...afterProjection,
  sessionId: "7fa7c456-0000-4000-8000-000000000001",
  uploaded: true,
};
assert(nextCreateWorkStep(afterUpload, true) === "poll_process", "uploaded media waits on processing then attach");

const attached = { ...afterUpload, attached: true, assetId: "asset-1" };
assert(nextCreateWorkStep(attached, true) === "complete", "attached media completes without a second master");

assert(isProtectedCanonicalId(SUPER_HERO_EGO_UNIVERSE), "Super Hero Ego Universe is protected");
assert(isProtectedCanonicalId(SUPER_HERO_EGO_MURAL), "Super Hero Ego Mural is protected");
assert(isProtectedCanonicalId(SUPER_HERO_EGO_MUX_ASSET), "Super Hero Ego Mux asset is protected");
assert(!isProtectedCanonicalId(afterMaster.masterId), "Father Raymond master is not the protected reference");

const waiting = createWorkContinuations({
  workType: "universe",
  masterId: afterMaster.masterId,
  mediaAttached: false,
  processingWaiting: true,
});
assert(waiting[0].href === `/authority/${afterMaster.masterId}`, "waiting continues to the existing work record");
assert(
  waiting.every((action) => !action.href.includes(SUPER_HERO_EGO_UNIVERSE)),
  "waiting continuation does not open Super Hero Ego",
);

const done = createWorkContinuations({
  workType: "universe",
  masterId: afterMaster.masterId,
  assetId: "new-asset",
  mediaAttached: true,
});
assert(done[0].label === "Continue in Curate", "completed universe continues in Curate");
assert(done[0].href === `/authority/curate/${afterMaster.masterId}`, "Curate is the created universe hub, not Super Hero Ego");
assert(done.some((action) => action.label === "Open Creative Studio"), "completed universe offers Creative Studio");
assert(done.some((action) => action.label === "Inspect media"), "attached media offers Inspect");

console.log("create-work-progress.test.mjs: ok");

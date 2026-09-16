import { classifyUniverseOccupancy, hasSourceMediaFromSession } from "../occupancy";
import { isPlayableStorageRef, isProtectedMaster } from "../protected-work";
import { canWithdrawMaster, decideWithdraw } from "../withdraw";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const SHE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
const SHE_MURAL = "a75ae8af-7b48-4b67-8392-d89447bae370";
const FR = "e22e080c-715c-4045-ba82-20474d25b2e0";
const FR_ASSET = "5f85a6f1-1f2a-4da7-af9b-8467e58d3b9c";
const DUPLICATE = "91027ced-7fd8-405a-8ecd-3ed874e27913";
const UNTITLED = "f11c3aba-2dcb-473a-b982-1b7442bd32b3";

assert(isProtectedMaster(SHE) === true, "Super Hero Ego Universe is protected");
assert(isProtectedMaster(SHE_MURAL) === true, "Super Hero Ego Mural is protected");
assert(isProtectedMaster(FR) === false, "Father Raymond is not Super Hero Ego");
assert(isProtectedMaster(UNTITLED) === false, "untitled Livepeer Universe is not protected");
assert(isPlayableStorageRef("operator:discarded:abc") === false, "discarded media is not playable");
assert(isPlayableStorageRef("JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4") === true, "Mux playback id remains playable");

const she = classifyUniverseOccupancy({
  title: "Super Hero Ego",
  currentStateId: "state",
  muralHasPlayableMedia: true,
  hasSourceMedia: true,
});
assert(she === "curated", "Super Hero Ego with mural media is curated");

const fr = classifyUniverseOccupancy({
  title: "Father Raymond - Golden Shovel feat Reverb 360",
  currentStateId: "state",
  muralHasPlayableMedia: false,
  hasSourceMedia: hasSourceMediaFromSession({ phase: "ingested", assetId: FR_ASSET }),
});
assert(fr === "in_progress", "Father Raymond with ingested Mux and no mural bind is in progress");
assert(hasSourceMediaFromSession({ phase: "ingested", assetId: FR_ASSET }) === true, "ingested session with asset is source media");

const duplicate = classifyUniverseOccupancy({
  title: "Father Raymond - Golden Shovel feat Reverb 360",
  currentStateId: "state",
  muralHasPlayableMedia: false,
  hasSourceMedia: hasSourceMediaFromSession({ phase: "created", assetId: null }),
});
assert(duplicate === "orphan", "Create Work retry shell with no ingested asset is an orphan");
assert(hasSourceMediaFromSession({ phase: "created", assetId: null }) === false, "created session without asset is not source media");

const untitled = classifyUniverseOccupancy({
  title: null,
  currentStateId: "state",
  muralHasPlayableMedia: false,
  hasSourceMedia: false,
});
assert(untitled === "orphan", "untitled Livepeer Universe without mural media is an orphan");

const withdrawn = classifyUniverseOccupancy({
  title: "Gone",
  currentStateId: null,
  muralHasPlayableMedia: false,
  hasSourceMedia: false,
});
assert(withdrawn === "withdrawn", "cleared current state is withdrawn");

const sheWithdraw = decideWithdraw({ masterId: SHE, currentStateId: "state" });
assert(sheWithdraw.ok === false && sheWithdraw.code === "protected_work", "Super Hero Ego cannot be withdrawn");

const muralWithdraw = decideWithdraw({ masterId: SHE_MURAL, currentStateId: "state" });
assert(muralWithdraw.ok === false && muralWithdraw.code === "protected_work", "Super Hero Ego Mural cannot be withdrawn");

const orphanWithdraw = decideWithdraw({ masterId: DUPLICATE, currentStateId: "state" });
assert(orphanWithdraw.ok === true && orphanWithdraw.action === "withdraw", "orphan Universe can be withdrawn");

const already = decideWithdraw({ masterId: UNTITLED, currentStateId: null });
assert(already.ok === true && already.action === "already_withdrawn", "second withdraw is idempotent");
assert(canWithdrawMaster(FR, "state") === true, "Father Raymond Universe can be withdrawn from the dashboard");
assert(canWithdrawMaster(SHE, "state") === false, "Super Hero Ego cannot be withdrawn from the dashboard");
assert(canWithdrawMaster(UNTITLED, null) === false, "already withdrawn work has no withdraw act");

const missing = decideWithdraw({ masterId: null });
assert(missing.ok === false && missing.code === "invalid_master", "withdraw without a master is rejected");

console.log("occupancy.test.mjs: ok");

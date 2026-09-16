import assert from "node:assert/strict";
import {
  inspectEmptyScenesCopy,
  inspectWorkBelongingCopy,
  nearestCanonicalScene,
  selectScenesForWork,
} from "../inspect-scope";

function test(name, fn) {
  fn();
}

const SHE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
const FR = "e22e080c-715c-4045-ba82-20474d25b2e0";

const powerhouse = {
  master_id: "4790c7cf-bb19-4a01-a243-e5c3eb680555",
  title: "Golden Shovel — Powerhouse",
  start_ms: 36000,
  end_ms: 79000,
  universe_id: SHE,
};

const darkKnight = {
  master_id: "bebb65d2-21ed-4bc9-9fa0-a4857df30a43",
  title: "Mothipa — Dark Knight",
  start_ms: 80000,
  end_ms: 124000,
  universe_id: SHE,
};

const globalDump = [powerhouse, darkKnight];
const fatherRaymondCandidateMs = 32525;

test("unbound / unknown work never receives another Universe's Scenes", () => {
  assert.equal(selectScenesForWork({ scenes: globalDump, universeId: null }).length, 0);
  assert.equal(
    nearestCanonicalScene(selectScenesForWork({ scenes: globalDump, universeId: null }), fatherRaymondCandidateMs),
    null,
  );
});

test("Father Raymond does not match Golden Shovel — Powerhouse", () => {
  const scoped = selectScenesForWork({ scenes: globalDump, universeId: FR });
  assert.equal(scoped.length, 0);
  assert.equal(nearestCanonicalScene(scoped, fatherRaymondCandidateMs), null);
  assert.equal(nearestCanonicalScene([], fatherRaymondCandidateMs), null);
});

test("Super Hero Ego still matches Powerhouse on its own media", () => {
  const scoped = selectScenesForWork({ scenes: globalDump, universeId: SHE });
  const nearest = nearestCanonicalScene(scoped, fatherRaymondCandidateMs);
  assert.equal(nearest?.scene.title, "Golden Shovel — Powerhouse");
  assert.equal(nearest?.deltaMs, 3475);
});

test("nearest match outside the threshold is ignored", () => {
  assert.equal(nearestCanonicalScene(globalDump, 200000, 10_000), null);
});

test("belonging copy names this Universe and refuses cross-work comparison", () => {
  assert.match(
    inspectWorkBelongingCopy({
      universe_id: FR,
      universe_title: "Father Raymond - Golden Shovel feat Reverb 360",
      source: "upload-session",
    }),
    /Father Raymond/,
  );
  assert.match(
    inspectWorkBelongingCopy({
      universe_id: FR,
      universe_title: "Father Raymond - Golden Shovel feat Reverb 360",
      source: "upload-session",
    }),
    /not Scenes from another Universe/,
  );
  assert.match(
    inspectWorkBelongingCopy({ universe_id: null, universe_title: null, source: "unbound" }),
    /Super Hero Ego/,
  );
  assert.match(
    inspectWorkBelongingCopy({
      universe_id: SHE,
      universe_title: "Super Hero Ego",
      source: "binding",
    }),
    /Super Hero Ego/,
  );
});

test("empty Scene copy does not invite a Super Hero Ego comparison", () => {
  const copy = inspectEmptyScenesCopy({
    universe_id: FR,
    universe_title: "Father Raymond - Golden Shovel feat Reverb 360",
    sceneCount: 0,
  });
  assert.match(copy ?? "", /Father Raymond/);
  assert.match(copy ?? "", /another Universe/);
  assert.equal(
    inspectEmptyScenesCopy({ universe_id: SHE, universe_title: "Super Hero Ego", sceneCount: 4 }),
    null,
  );
});

console.log("inspect-scope.test.mjs: ok");

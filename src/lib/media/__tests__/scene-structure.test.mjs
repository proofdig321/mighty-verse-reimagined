import {
  composeSceneTitle,
  isSceneStructureRoleId,
  sceneStructureLabel,
  SCENE_STRUCTURE_ROLES,
} from "../scene-structure";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(SCENE_STRUCTURE_ROLES.map((role) => role.id).join(",") === "intro,verse_1,hook,verse_2,bridge,verse_3,outro,other", "closed editorial structure set");
assert(isSceneStructureRoleId("hook") === true, "hook is a known role");
assert(isSceneStructureRoleId("chorus") === false, "chorus is not a silent alias — curator picks Hook");
assert(sceneStructureLabel("verse_1") === "Verse 1", "verse labels stay human");
assert(composeSceneTitle("intro") === "Intro", "role alone is a valid Scene title");
assert(composeSceneTitle("hook", "  Hook  ") === "Hook", "duplicate custom copy does not double the title");
assert(composeSceneTitle("verse_2", "Father Raymond") === "Verse 2 — Father Raymond", "custom copy is attributed after the role");
assert(composeSceneTitle("other", "Worldwide Studios card") === "Worldwide Studios card", "Other uses the curator title as-is");

console.log("scene-structure.test.mjs: ok");

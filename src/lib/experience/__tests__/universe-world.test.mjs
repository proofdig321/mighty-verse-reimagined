import { contributorPresence, sceneShortTitle } from "../universe-world";

const POWERHOUSE = "4790c7cf-bb19-4a01-a243-e5c3eb680555";
const DARK_KNIGHT = "bebb65d2-21ed-4bc9-9fa0-a4857df30a43";
const HAND_TO_HAND = "df15ec76-6bd8-4956-bbaa-755f72b2b8f8";
const SWORD_MASTER = "65490a92-8faf-42ea-a391-0e6473360f5c";
const PROVERB = "3b0de6b4-2ca0-43c0-8561-7dc1c0697435";
const MOTHIPA = "32422bb4-d03c-465d-8348-942e49ae0051";
const REASON = "2745a50a-5417-4613-b23b-ef4857ab112e";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const scenes = [
  { master_id: POWERHOUSE, title: "Golden Shovel — Powerhouse", projection_id: "p1", playback_id: null, provider: null, start_ms: 36000, end_ms: 79000 },
  { master_id: DARK_KNIGHT, title: "Mothipa — Dark Knight", projection_id: "p2", playback_id: null, provider: null, start_ms: 80000, end_ms: 124000 },
  { master_id: HAND_TO_HAND, title: "ProVerb — Hand-to-Hand", projection_id: "p3", playback_id: null, provider: null, start_ms: 149000, end_ms: 192000 },
  { master_id: SWORD_MASTER, title: "Reason — Sword Master", projection_id: "p4", playback_id: null, provider: null, start_ms: 193000, end_ms: 254000 },
];

const moments = [
  { master_id: PROVERB, title: "Proverb", projection_id: null },
  { master_id: MOTHIPA, title: "Mothipa", projection_id: "718372da-4941-41d6-bb64-3a0b0812b047" },
  { master_id: REASON, title: "Reason", projection_id: "89ba1c24-01c1-4bbd-8ed1-d48021600b71" },
];

const relations = [
  { scene_master_id: POWERHOUSE, moment_master_id: PROVERB },
  { scene_master_id: DARK_KNIGHT, moment_master_id: MOTHIPA },
  { scene_master_id: HAND_TO_HAND, moment_master_id: PROVERB },
  { scene_master_id: SWORD_MASTER, moment_master_id: REASON },
];

const presence = contributorPresence(moments, scenes, relations);
const proverb = presence.find((item) => item.master_id === PROVERB);
const mothipa = presence.find((item) => item.master_id === MOTHIPA);
const reason = presence.find((item) => item.master_id === REASON);

assert(presence.length === 3, "three contributors from canonical Creative Moments");
assert(proverb && proverb.hasMomentProjection === false, "Proverb remains identity-only");
assert(proverb.href === `/creative-moments/${PROVERB}`, "Proverb does not fabricate a Moment Card route");
assert(proverb.scenes.map((scene) => scene.shortTitle).join(",") === "Powerhouse,Hand-to-Hand", "Proverb stays related to both Scenes");
assert(mothipa && mothipa.hasMomentProjection === true, "Mothipa keeps its Moment projection");
assert(mothipa.href === "/moments/718372da-4941-41d6-bb64-3a0b0812b047", "Mothipa encounter uses existing Moment route");
assert(reason && reason.scenes[0].shortTitle === "Sword Master", "Reason relates to Sword Master only");
assert(sceneShortTitle("Golden Shovel — Powerhouse") === "Powerhouse", "encounter titles use cinematic short names");

console.log("Universe Experience helpers: all passed");

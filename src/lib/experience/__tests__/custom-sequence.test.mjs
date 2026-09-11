import {
  addToCustomSequence,
  clearCustomSequence,
  removeCustomSequenceSlot,
  sequenceThumbnailUrl,
  sequenceToPlaybackSegments,
} from "../custom-sequence";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const powerhouse = {
  id: "4790c7cf-bb19-4a01-a243-e5c3eb680555",
  title: "Golden Shovel — Powerhouse",
  playbackId: "JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4",
  provider: "mux",
  startMs: 36000,
};

const first = addToCustomSequence([], powerhouse);
assert(first.length === 1, "first add creates a sequence slot");
assert(first[0].title === "Golden Shovel — Powerhouse", "sequence stores the Scene title, not a master id");
assert(first[0].startMs === 36000, "sequence keeps the Mux window marker");
assert(
  sequenceThumbnailUrl(powerhouse).includes("time=36"),
  "sequence still uses the Scene Mux thumbnail time, not mural time=0",
);
assert(addToCustomSequence(first, powerhouse).length === 1, "duplicate Scene is not appended");
assert(removeCustomSequenceSlot(first, powerhouse.id).length === 0, "remove drops the client slot");
assert(clearCustomSequence().length === 0, "clear empties the client sequence");
const playable = sequenceToPlaybackSegments(addToCustomSequence([], { ...powerhouse, endMs: 79000, projectionId: "3039ca84-7e11-4eb6-8895-d16d13a899c3" }));
assert(playable.length === 1, "sequence maps onto the existing TimelinePlayer segments");
assert(playable[0].startMs === 36000 && playable[0].endMs === 79000, "player keeps the canonical Scene window");
assert(playable[0].playbackId === powerhouse.playbackId, "player keeps the Mux storage ref, not a new identity");

console.log("custom-sequence.test.mjs: ok");

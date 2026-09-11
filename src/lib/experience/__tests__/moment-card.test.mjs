import { momentCardStillUrl } from "../moment-card";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const PLAYBACK = "JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4";

const proverb = momentCardStillUrl({
  provider: "mux",
  storage_ref: PLAYBACK,
  start_ms: 36000,
});
const reason = momentCardStillUrl({
  provider: "mux",
  storage_ref: PLAYBACK,
  start_ms: 193000,
});
const empty = momentCardStillUrl({
  provider: "mux",
  storage_ref: null,
  start_ms: 193000,
});

assert(proverb.includes("image.mux.com") && proverb.includes("time=36"), "Proverb card uses the Powerhouse still");
assert(reason.includes("time=193"), "Reason card uses the Sword Master still");
assert(empty === null, "a Creative Moment without Scene media does not invent a still");
assert(proverb !== reason, "contributor cards do not share one mural poster");

console.log("Moment card still tests: all passed");

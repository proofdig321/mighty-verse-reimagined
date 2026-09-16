import { formatMuxAssetFailure } from "../mux-asset-error";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const youtubeWatchPage = formatMuxAssetFailure({
  status: "errored",
  errors: {
    type: "invalid_input",
    messages: ["The input file was not a valid video or audio file."],
  },
});
assert(
  youtubeWatchPage === "Mux invalid_input: The input file was not a valid video or audio file.",
  "Mux watch-page failure is the real invalid_input message",
);

assert(
  formatMuxAssetFailure({ status: "errored", errors: null }) === "Mux asset processing failed.",
  "errored without messages stays a provider failure",
);
assert(formatMuxAssetFailure({ status: "preparing" }) === null, "preparing is not a failure");

console.log("mux-asset-error.test.mjs: ok");

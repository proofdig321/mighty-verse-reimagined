import { decideMuxUrlIngestMethod } from "../url-ingest-method";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(decideMuxUrlIngestMethod("youtube") === "youtube-file", "YouTube watch URLs are not Mux URL-pull inputs");
assert(decideMuxUrlIngestMethod("direct") === "mux-url-pull", "direct HTTPS files still use Mux URL pull");

console.log("url-ingest-method.test.mjs: ok");

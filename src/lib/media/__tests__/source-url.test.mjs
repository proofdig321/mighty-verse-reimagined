import { parseMediaSourceUrl } from "../source-url";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const watch = parseMediaSourceUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
assert(watch.ok && watch.kind === "youtube", "watch URLs are YouTube ingest sources");
assert(watch.ok && watch.url === "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "watch URLs stay canonical");

const short = parseMediaSourceUrl("https://youtu.be/dQw4w9WgXcQ");
assert(short.ok && short.kind === "youtube" && short.url.includes("watch?v=dQw4w9WgXcQ"), "youtu.be normalizes to watch");

const shorts = parseMediaSourceUrl("https://youtube.com/shorts/dQw4w9WgXcQ");
assert(shorts.ok && shorts.kind === "youtube", "shorts URLs are YouTube ingest sources");

const direct = parseMediaSourceUrl("https://cdn.example.com/clip.mp4");
assert(direct.ok && direct.kind === "direct", "direct HTTPS files remain pullable");

const http = parseMediaSourceUrl("http://youtube.com/watch?v=dQw4w9WgXcQ");
assert(!http.ok, "HTTP is rejected");

const missing = parseMediaSourceUrl("https://youtube.com/watch");
assert(!missing.ok, "YouTube URLs without a video id are rejected");

console.log("source-url.test.mjs: ok");

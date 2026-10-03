import { isStudioCanvasPath } from "../studio-path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(isStudioCanvasPath("/studio"), "studio home should use the canvas shell");
assert(isStudioCanvasPath("/studio/work"), "studio work list should use the canvas shell");
assert(isStudioCanvasPath("/studio/work/abc123"), "studio work editor should use the canvas shell");
assert(isStudioCanvasPath("/authority/universes/abc123"), "universe studio routes should use the canvas shell");
assert(!isStudioCanvasPath("/authority"), "global authority hub should not be treated as canvas-only");
assert(!isStudioCanvasPath("/"), "home should not be treated as canvas-only");

console.log("Studio canvas path tests: all passed");

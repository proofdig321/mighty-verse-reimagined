import { parseStructuredStoryboard, parseStructuredStoryboardJson } from "../structured-storyboard";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const parsed = parseStructuredStoryboard({
  title: "Night Walk",
  body: "A walker crosses the mural.",
  panels: [
    { sequence: 1, title: "Approach", description: "Wide night street", camera: "crane up", duration_seconds: 8, aspect_ratio: "16:9" },
    { title: "", description: "" },
  ],
});
assert(parsed && parsed.creates_scene === false && parsed.creates_canonical === false, "structured storyboard is not canonical");
assert(parsed.panels.length === 1, "empty panels are dropped");
assert(parsed.panels[0].camera === "crane up", "camera is preserved");
assert(parseStructuredStoryboard({ panels: [] }) === null, "empty body and panels are rejected");
assert(parseStructuredStoryboardJson("not-json") === null, "malformed JSON is rejected");
assert(parseStructuredStoryboardJson("```json\n{\"title\":\"A\",\"body\":\"B\",\"panels\":[{\"sequence\":1,\"title\":\"One\",\"description\":\"Beat\"}]}\n```")?.panels.length === 1, "fenced JSON is accepted");

console.log("Structured storyboard tests: all passed");

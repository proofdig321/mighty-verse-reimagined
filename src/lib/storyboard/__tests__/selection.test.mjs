import assert from "node:assert/strict";
import { collectActiveReferenceUrls, resolveStoryboardSelection } from "../selection.ts";

const persisted = {
  panel_id: "p1",
  title: "Entry",
  description: "A caught frame",
  duration_ms: 4000,
  still_url: "https://example.com/persisted.jpg",
  camera: "wide",
  camera_movement: "tracking",
  transition: "cut",
  motion_endpoint: "https://example.com/endpoint.m3u8",
  references: [{ url: "https://example.com/ref.jpg" }, { url: null }],
};

const selected = resolveStoryboardSelection({
  selectedPersisted: persisted,
  selectedScript: null,
  selectedSentinel: null,
  selectedScene: null,
  panelStills: { p1: "https://example.com/still-override.jpg" },
});

assert.equal(selected.title, "Entry");
assert.equal(selected.kind, "Storyboard panel");
assert.equal(selected.time, "4s");
assert.equal(selected.still, "https://example.com/still-override.jpg");
assert.equal(selected.endpoint, "https://example.com/endpoint.m3u8");

const refs = collectActiveReferenceUrls({
  references: [{ still_url: "https://example.com/gallery.jpg" }, { still_url: null }],
  workFrames: [{ still_url: "https://example.com/work-frame.jpg" }],
  persistedPanels: [{ references: [{ url: "https://example.com/attached.jpg" }, { url: null }] }],
});

assert.deepEqual(refs, [
  "https://example.com/gallery.jpg",
  "https://example.com/work-frame.jpg",
  "https://example.com/attached.jpg",
]);

console.log("Storyboard selection helpers: all passed");

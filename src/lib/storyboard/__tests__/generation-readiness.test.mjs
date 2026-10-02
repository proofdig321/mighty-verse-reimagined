import assert from "node:assert/strict";
import { deriveGenerationReadiness } from "../generation-readiness.ts";

const readyForFirstLast = deriveGenerationReadiness({
  intent: "clip",
  resolvedKind: "first-last-frame",
  hasStill: true,
  hasMotion: false,
  stillReady: { available: true, reason: null },
  motionReady: { available: false, reason: "No motion" },
  effectiveFirstFrame: "https://example.com/start.jpg",
  effectiveLastFrame: "https://example.com/end.jpg",
  referenceUrls: [],
  extensionVideoUri: null,
  effectiveEditUri: null,
  workFramesLength: 2,
});

assert.deepEqual(readyForFirstLast, { available: true, reason: null }, "the first + last frame mode should be ready when both frames are present");

const readyForReferenceMotion = deriveGenerationReadiness({
  intent: "clip",
  resolvedKind: "reference-motion",
  hasStill: false,
  hasMotion: false,
  stillReady: { available: false, reason: "No still" },
  motionReady: { available: false, reason: "No motion" },
  effectiveFirstFrame: "",
  effectiveLastFrame: "",
  referenceUrls: ["https://example.com/ref-1.jpg"],
  extensionVideoUri: null,
  effectiveEditUri: null,
  workFramesLength: 0,
});

assert.deepEqual(readyForReferenceMotion, { available: true, reason: null }, "references should satisfy the reference-to-video workflow");

console.log("Storyboard generation helper: all passed");

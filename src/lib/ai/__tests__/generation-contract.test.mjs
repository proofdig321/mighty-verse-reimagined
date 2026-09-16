import { canRetryJob, generationIdempotencyKey, jobProgressPercent, jobUiLabel, transitionJob } from "../jobs";
import { aiServiceCapability } from "../config";
import { textModelFallbacks } from "../config";
import { classifyGeminiHttpError, unconfiguredFailure } from "../errors";
import { composeMotionPrompt, composeStillPrompt } from "../prompt-composer";
import { veoRequestBody } from "../gemini";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(transitionJob("queued", { type: "submit" }) === "submitted", "queue submits");
assert(transitionJob("submitted", { type: "progress" }) === "processing", "submit processes");
assert(transitionJob("processing", { type: "complete" }) === "completed", "process completes");
assert(transitionJob("completed", { type: "fail" }) === "completed", "completed is terminal");
assert(transitionJob("processing", { type: "block" }) === "blocked", "safety blocks");
assert(jobProgressPercent("processing", 150) === 99, "progress never fakes 100 while processing");
assert(jobProgressPercent("completed") === 100, "completed is 100");
assert(jobProgressPercent("failed") === null, "failed has no fake percent");
assert(jobUiLabel("needs_configuration") === "Needs configuration", "configuration is honest");
assert(canRetryJob("blocked", true) === false, "safety is not auto-retried");
assert(canRetryJob("failed", true) === true, "failed can retry");
assert(
  generationIdempotencyKey({ participantId: "p", kind: "still", panelId: "a", prompt: "same" }) ===
    generationIdempotencyKey({ participantId: "p", kind: "still", panelId: "a", prompt: "same" }),
  "idempotency is stable",
);

const quota = classifyGeminiHttpError({ httpStatus: 429, bodyText: "{\"error\":{\"message\":\"Quota exceeded\"}}" });
assert(quota.code === "quota" && quota.retryable === false, "quota is not a missing product feature");
assert(quota.message.includes("Quota") || quota.message.includes("quota"), "quota message stays provider-honest");
assert(unconfiguredFailure().status === "needs_configuration", "missing key is configuration, not architecture");

const still = composeStillPrompt({
  panel: { title: "Powerhouse", description: "Golden Shovel holds the street", characters: "Golden Shovel", environment: "Johannesburg night", lighting: "neon rim" },
});
assert(still.includes("Golden Shovel") && still.includes("neon rim"), "still prompt uses creative fields");
assert(!still.includes("05ccc0c6"), "prompt composer does not dump UUIDs");

const motion = composeMotionPrompt({
  panel: { title: "Sword", description: "Reason turns", action: "draws the blade", camera: "orbit", dialogue: "Hold the line" },
}, { audioIntention: "metallic scrape and crowd hush", aspectRatio: "16:9" });
assert(motion.includes("draws the blade") && motion.includes("Hold the line"), "motion prompt is composed, not concatenated junk");

const body = veoRequestBody({
  prompt: "A mural breathes",
  firstFrame: { mime: "image/png", bytes: Buffer.from("abc") },
  lastFrame: { mime: "image/png", bytes: Buffer.from("def") },
});
assert(body.instances[0].image.bytesBase64Encoded, "first frame is instance.image");
assert(body.instances[0].lastFrame.bytesBase64Encoded, "last frame is instance.lastFrame");
assert(body.parameters.durationSeconds === 8, "first/last interpolation uses 8 seconds");
assert(body.parameters.generateAudio === true, "audio intention is requested when supported");
const noAudioParam = veoRequestBody({ prompt: "A mural breathes", includeAudioParameter: false });
assert(!("generateAudio" in noAudioParam.parameters), "unsupported generateAudio is omitted on retry");

const refs = veoRequestBody({
  prompt: "Character continuity",
  aspectRatio: "9:16",
  referenceImages: [{ mime: "image/png", bytes: Buffer.from("a") }],
});
assert(refs.parameters.aspectRatio === "16:9", "reference images stay on 16:9");
assert(refs.instances[0].referenceImages.length === 1, "reference images are capped in the instance");

const capability = aiServiceCapability();
assert(Object.prototype.hasOwnProperty.call(capability, "configured"), "capability reports configured without exposing the key");
assert(textModelFallbacks("gemini-2.0-flash")[0] === "gemini-2.0-flash", "configured text model stays first");
assert(textModelFallbacks("gemini-2.0-flash").includes("gemini-2.5-flash"), "shut-down text models fall back to a live Flash model");
assert(capability.models.text === "gemini-2.5-flash" || capability.models.text.length > 0, "text model is configurable");
if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.GOOGLE_API_KEY) {
  assert(capability.configured === false, "missing key is configuration, not a missing product");
  assert(capability.modes["text-to-video"].available === false, "unconfigured video reports unavailable honestly");
}

console.log("AI job/error/prompt tests: all passed");

import {
  CINEMATIC_KIND,
  attachStillUrls,
  cameraEvidenceStatus,
  cinematicToPanelProposal,
  composeFallbackCinematic,
  evidenceStatusLabel,
  observationsFromCinematic,
  parseCinematicAnalysis,
  parseCinematicShot,
  representativeTimeMs,
  sampleTimesMs,
  temporalEvidenceStatus,
  visualEvidenceStatus,
} from "../cinematic-evidence";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(representativeTimeMs(0, 8000) > 0, "Judas-style opening window must not use time=0");
assert(representativeTimeMs(0, 500) === 250, "short windows may use midpoint");

const fallback = composeFallbackCinematic({
  playbackId: "hqGacPkUZZuWiTu4kl9DZQx56IutFzfnXnsgDr1LHEM",
  assetId: null,
  durationMs: 60_000,
  cues: [
    { time_ms: 0, mean_luminance: 4, change_score: 0.01, is_boundary_candidate: false },
    { time_ms: 5200, mean_luminance: 80, change_score: 0.4, is_boundary_candidate: true },
    { time_ms: 18000, mean_luminance: 90, change_score: 0.5, is_boundary_candidate: true },
  ],
  limitation: "Gemini is not configured.",
});

assert(fallback.kind === CINEMATIC_KIND, "fallback is cinematic evidence");
assert(fallback.creates_scene === false && fallback.creates_canonical === false, "fallback never creates Scenes");
assert(fallback.analysis_mode === "sampled-fallback", "fallback is labeled honestly");
assert(fallback.shots.length >= 2, "fallback produces a temporal breakdown, not one still");
assert(fallback.shots.every((shot) => shot.time_ms > 0), "fallback representative frames avoid time=0");
assert(fallback.shots.every((shot) => shot.camera === "unknown"), "fallback does not invent camera movement");
assert(fallback.shots.every((shot) => cameraEvidenceStatus(shot) === "unknown"), "fallback camera is insufficient evidence");
assert(evidenceStatusLabel("unknown").includes("insufficient"), "unknown evidence is labeled");
assert(visualEvidenceStatus("Johannesburg night") === "observed", "visible environment is observed");
assert(temporalEvidenceStatus("unknown") === "unknown", "unknown motion stays unknown");
assert(temporalEvidenceStatus("Lateral entry") === "inferred", "action across time is inferred, not observed camera");
assert(fallback.shots[0].confidence === "low", "fallback confidence is low");
assert(fallback.overview.includes("Fallback"), "overview states fallback");

const geminiShots = parseCinematicAnalysis({
  overview: "Performer enters and continues.",
  shots: [
    {
      sequence: 1,
      start_ms: 0,
      end_ms: 4200,
      framing: "wide",
      camera: "static",
      camera_explanation: "Camera appears static on a wide stage.",
      subjects: [{ description: "Performer A", position: "centre-left", action: "enters" }],
      motion: "Lateral entry",
      action: "Performer walks into frame",
      environment: "Stage",
      lighting: "mixed",
      transition: "unknown",
      narrative: "Opening.",
      what_happens: "The performer enters from screen-left.",
      confidence: "medium",
    },
    {
      sequence: 2,
      start_ms: 4200,
      end_ms: 11000,
      framing: "medium",
      camera: "tracking",
      what_happens: "The performer moves toward centre.",
      motion: "Forward/lateral",
      action: "continues performance",
      environment: "Stage",
      transition: "cut",
      confidence: "high",
    },
  ],
});

assert(geminiShots?.shots.length === 2, "Gemini JSON without kind still parses");
assert(geminiShots.shots[1].camera === "tracking", "camera enum is preserved");
assert(geminiShots.shots[0].subjects[0].description === "Performer A", "subjects parse");
assert(parseCinematicShot(geminiShots.shots[1])?.shot_id, "individual shots parse");
assert(parseCinematicAnalysis({ kind: "other", hello: true }) === null, "unrelated JSON is rejected");

const proposed = cinematicToPanelProposal(geminiShots.shots[1]);
assert(proposed.title === "Shot 02", "panel title uses shot sequence");
assert(proposed.camera_movement === "tracking", "camera proposal maps to panel movement");
assert(proposed.description.includes("centre"), "what happens becomes description");

const keyed = attachStillUrls(geminiShots, "hqGacPkUZZuWiTu4kl9DZQx56IutFzfnXnsgDr1LHEM");
assert(keyed.shots[1].still_url?.includes("time="), "timed frames use Mux time=");
assert(!keyed.shots[1].still_url?.includes("time=0"), "representative still is not time=0");

const times = sampleTimesMs(60_000, fallback.shots.map((shot) => ({
  time_ms: shot.start_ms,
  mean_luminance: null,
  change_score: 0.3,
  is_boundary_candidate: true,
})), 8);
assert(times.every((time) => time > 0), "sampled Gemini frames skip time=0");
assert(times.length >= 2, "whole-video sampling uses multiple frames");

const fromCinematic = observationsFromCinematic(geminiShots);
assert(fromCinematic.length === geminiShots.shots.length, "cinematic shots persist as Universe observations");
assert(fromCinematic.some((row) => row.is_boundary_candidate), "shot cuts remain boundary candidates");

console.log("Cinematic evidence tests: all passed");

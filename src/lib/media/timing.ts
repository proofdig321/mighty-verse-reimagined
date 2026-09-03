export type SceneTiming = {
  id: string;
  title: string | null;
  startMs: number;
  endMs: number;
};

export function clampTime(time: number, duration: number) {
  if (!Number.isFinite(time) || time < 0) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(time, duration);
}

export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

export function validateSceneTiming(scene: SceneTiming, durationMs?: number) {
  return scene.startMs >= 0 && scene.endMs > scene.startMs && (durationMs == null || scene.endMs <= durationMs);
}

export function sortSceneTimings(scenes: SceneTiming[], durationMs?: number) {
  return scenes
    .filter((scene) => validateSceneTiming(scene, durationMs))
    .map((scene, index) => ({ scene, index }))
    .sort((a, b) => a.scene.startMs - b.scene.startMs || a.index - b.index)
    .map(({ scene }) => scene);
}

export function findActiveScene(scenes: SceneTiming[], timeMs: number) {
  // Earlier scene order wins when valid scene ranges overlap.
  return scenes.find((scene) => timeMs >= scene.startMs && timeMs < scene.endMs)?.id ?? null;
}

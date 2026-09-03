export type SceneTiming = {
  id: string;
  title: string | null;
  startMs: number;
  endMs: number;
};

export function clampTime(time: number, duration: number) {
  if (!Number.isFinite(time) || time < 0) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return time;
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
    .sort((a, b) => a.startMs - b.startMs);
}

export function findActiveScene(scenes: SceneTiming[], timeMs: number) {
  return scenes.find((scene) => timeMs >= scene.startMs && timeMs < scene.endMs)?.id ?? null;
}

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

export function formatTimelineMs(value: number | null): string {
  if (value == null) return "--:--.---";
  const totalSeconds = Math.floor(value / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}.${String(value % 1000).padStart(3, "0")}`;
}

/**
 * Parse a Scene window into canonical milliseconds.
 * Accepts integer ms (`36000`), `0:36`, and `0:36.000`.
 */
export function parseTimelineMs(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) return null;
    return value;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const ms = Number(trimmed);
    return Number.isInteger(ms) && ms >= 0 ? ms : null;
  }
  const match = trimmed.match(/^(\d+):([0-5]?\d)(?:\.(\d{1,3}))?$/);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const fraction = match[3] ? match[3].padEnd(3, "0") : "000";
  return minutes * 60_000 + seconds * 1000 + Number(fraction);
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

/**
 * Storyboard authoring history.
 * Snapshots local authored state. Provider generations are not reversed.
 */

export type HistoryKind = "authoring" | "selection" | "generation";

export type AuthoringPanelSnapshot = {
  panel_id: string;
  sequence: number;
  title: string;
  description: string;
  narrative_purpose: string | null;
  action: string | null;
  dialogue: string | null;
  narration: string | null;
  camera: string | null;
  camera_movement: string | null;
  framing: string | null;
  lens_style: string | null;
  lighting: string | null;
  environment: string | null;
  characters: string | null;
  mood: string | null;
  transition: string | null;
  duration_ms: number | null;
  aspect_ratio: string | null;
  status: string;
  active_still_asset_id: string | null;
  active_motion_asset_id: string | null;
  still_url: string | null;
  motion_playback_id: string | null;
  motion_endpoint: string | null;
  references: Array<{ role: string; label: string; asset_id?: string | null; url?: string | null; preferred?: boolean }>;
  user_locked: boolean;
};

export type AssemblyItemSnapshot = {
  id: string;
  kind: "still" | "motion" | "source" | "reference";
  label: string;
  panel_id?: string | null;
  asset_id?: string | null;
  url?: string | null;
  playback_id?: string | null;
  endpoint?: string | null;
};

export type AuthoringSnapshot = {
  title: string;
  body: string;
  premise: string | null;
  panels: AuthoringPanelSnapshot[];
  assembly: AssemblyItemSnapshot[];
};

export type HistoryEntry = {
  id: string;
  label: string;
  kind: HistoryKind;
  reversible: boolean;
  persistent: boolean;
  undoHint: string;
  before: AuthoringSnapshot;
  after: AuthoringSnapshot;
};

export type HistoryState = {
  past: HistoryEntry[];
  future: HistoryEntry[];
};

export const HISTORY_LIMIT = 40;

export function emptyHistory(): HistoryState {
  return { past: [], future: [] };
}

export function cloneSnapshot(snapshot: AuthoringSnapshot): AuthoringSnapshot {
  return structuredClone(snapshot);
}

export function snapshotsEqual(left: AuthoringSnapshot, right: AuthoringSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function pushHistory(state: HistoryState, entry: HistoryEntry): HistoryState {
  if (snapshotsEqual(entry.before, entry.after)) return state;
  return {
    past: [...state.past, entry].slice(-HISTORY_LIMIT),
    future: [],
  };
}

export function undoHistory(state: HistoryState): { state: HistoryState; entry: HistoryEntry } | null {
  const entry = state.past[state.past.length - 1];
  if (!entry) return null;
  if (!entry.reversible) return null;
  return {
    state: {
      past: state.past.slice(0, -1),
      future: [...state.future, entry],
    },
    entry,
  };
}

export function redoHistory(state: HistoryState): { state: HistoryState; entry: HistoryEntry } | null {
  const entry = state.future[state.future.length - 1];
  if (!entry) return null;
  return {
    state: {
      past: [...state.past, entry],
      future: state.future.slice(0, -1),
    },
    entry,
  };
}

export function historyStorageKey(workId: string) {
  return `mv-storyboard-history:${workId}`;
}

export function serializeHistory(state: HistoryState): string {
  return JSON.stringify(state);
}

export function parseHistory(value: string | null | undefined): HistoryState {
  if (!value) return emptyHistory();
  try {
    const parsed = JSON.parse(value) as HistoryState;
    if (!Array.isArray(parsed.past) || !Array.isArray(parsed.future)) return emptyHistory();
    return {
      past: parsed.past.slice(-HISTORY_LIMIT),
      future: parsed.future.slice(-HISTORY_LIMIT),
    };
  } catch {
    return emptyHistory();
  }
}

export function workToSnapshot(work: {
  title: string;
  body: string;
  premise: string | null;
  panels: AuthoringPanelSnapshot[];
  assembly?: AssemblyItemSnapshot[] | null;
}): AuthoringSnapshot {
  return {
    title: work.title,
    body: work.body,
    premise: work.premise,
    panels: work.panels.map((panel) => ({ ...panel })),
    assembly: work.assembly ? [...work.assembly] : [],
  };
}

export function saveStatusLabel(input: {
  dirty: boolean;
  saving: boolean;
  failed: boolean;
  offline?: boolean;
}): "Saved" | "Saving…" | "Unsaved changes" | "Save failed" | "Offline / unable to save" {
  if (input.offline) return "Offline / unable to save";
  if (input.saving) return "Saving…";
  if (input.failed) return "Save failed";
  if (input.dirty) return "Unsaved changes";
  return "Saved";
}

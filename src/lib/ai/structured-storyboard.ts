/**
 * Structured Gemini storyboard output.
 * Malformed provider JSON never becomes database rows.
 */

export const STORYBOARD_JSON_SCHEMA = {
  type: "OBJECT",
  required: ["title", "body", "panels"],
  properties: {
    title: { type: "STRING" },
    premise: { type: "STRING" },
    body: { type: "STRING" },
    tone: { type: "STRING" },
    genre: { type: "STRING" },
    audience: { type: "STRING" },
    creative_intent: { type: "STRING" },
    panels: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["sequence", "title", "description"],
        properties: {
          sequence: { type: "INTEGER" },
          title: { type: "STRING" },
          description: { type: "STRING" },
          narrative_purpose: { type: "STRING" },
          action: { type: "STRING" },
          dialogue: { type: "STRING" },
          narration: { type: "STRING" },
          camera: { type: "STRING" },
          camera_movement: { type: "STRING" },
          framing: { type: "STRING" },
          lens_style: { type: "STRING" },
          lighting: { type: "STRING" },
          environment: { type: "STRING" },
          characters: { type: "STRING" },
          mood: { type: "STRING" },
          transition: { type: "STRING" },
          duration_seconds: { type: "INTEGER" },
          aspect_ratio: { type: "STRING" },
        },
      },
    },
  },
} as const;

export type StructuredStoryboardPanel = {
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
  duration_seconds: number | null;
  aspect_ratio: string | null;
};

export type StructuredStoryboard = {
  title: string;
  premise: string | null;
  body: string;
  tone: string | null;
  genre: string | null;
  audience: string | null;
  creative_intent: string | null;
  panels: StructuredStoryboardPanel[];
  creates_scene: false;
  creates_canonical: false;
};

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 4000) : null;
}

function integer(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

export function parseStructuredStoryboard(raw: unknown): StructuredStoryboard | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const body = text(record.body) ?? text(record.story) ?? "";
  const title = text(record.title) ?? "Untitled storyboard";
  const panelsRaw = Array.isArray(record.panels) ? record.panels : [];
  const panels: StructuredStoryboardPanel[] = [];
  for (const [index, item] of panelsRaw.entries()) {
    if (!item || typeof item !== "object") continue;
    const panel = item as Record<string, unknown>;
    const description = text(panel.description) ?? text(panel.action) ?? text(panel.title);
    const panelTitle = text(panel.title);
    if (!description && !panelTitle) continue;
    const duration = integer(panel.duration_seconds);
    const aspect = text(panel.aspect_ratio);
    panels.push({
      sequence: integer(panel.sequence) ?? index + 1,
      title: (panelTitle ?? description ?? `Panel ${index + 1}`).slice(0, 160),
      description: description ?? panelTitle ?? "",
      narrative_purpose: text(panel.narrative_purpose),
      action: text(panel.action),
      dialogue: text(panel.dialogue),
      narration: text(panel.narration),
      camera: text(panel.camera),
      camera_movement: text(panel.camera_movement) ?? text(panel.movement),
      framing: text(panel.framing),
      lens_style: text(panel.lens_style),
      lighting: text(panel.lighting),
      environment: text(panel.environment),
      characters: text(panel.characters) ?? text(panel.subjects),
      mood: text(panel.mood),
      transition: text(panel.transition),
      duration_seconds: duration && duration > 0 && duration <= 30 ? duration : null,
      aspect_ratio: aspect === "9:16" || aspect === "16:9" ? aspect : null,
    });
  }
  if (!body && panels.length === 0) return null;
  panels.sort((left, right) => left.sequence - right.sequence);
  return {
    title,
    premise: text(record.premise),
    body: body || panels.map((panel) => panel.description).join("\n"),
    tone: text(record.tone),
    genre: text(record.genre),
    audience: text(record.audience),
    creative_intent: text(record.creative_intent),
    panels: panels.map((panel, index) => ({ ...panel, sequence: index + 1 })),
    creates_scene: false,
    creates_canonical: false,
  };
}

export function parseStructuredStoryboardJson(textValue: string): StructuredStoryboard | null {
  const trimmed = textValue.trim();
  if (!trimmed) return null;
  try {
    return parseStructuredStoryboard(JSON.parse(trimmed));
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/i);
    if (!fenced) return null;
    try {
      return parseStructuredStoryboard(JSON.parse(fenced[1]));
    } catch {
      return null;
    }
  }
}

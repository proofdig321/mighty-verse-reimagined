/**
 * Storyboard script materials.
 *
 * Script is creative intent, not canonical ontology. Parsing panels never
 * creates Scenes, Creative Moments, or projections.
 */

export type StoryboardScriptPanel = {
  panel_id: string;
  sequence: number;
  title: string;
  description: string;
  camera: string | null;
  movement: string | null;
  transition: string | null;
  source: "script";
  creates_scene: false;
};

export type StoryboardScriptBody = {
  body: string;
  panels: StoryboardScriptPanel[];
  creates_scene: false;
  creates_canonical: false;
};

const DIRECTION_RE = /^(camera|cam|movement|move|transition|cut to|dissolve|fade)\s*[:\-]\s*(.+)$/i;

export function panelsFromStoryBody(script: string): StoryboardScriptPanel[] {
  const lines = script
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const panels: StoryboardScriptPanel[] = [];

  for (const line of lines) {
    const direction = line.match(DIRECTION_RE);
    if (direction) {
      const kind = direction[1].toLowerCase();
      const value = direction[2].trim();
      const target = panels[panels.length - 1];
      if (!target) continue;
      if (kind.startsWith("cam")) target.camera = value;
      else if (kind.startsWith("move")) target.movement = value;
      else target.transition = value;
      continue;
    }
    panels.push({
      panel_id: `script-${panels.length + 1}`,
      sequence: panels.length + 1,
      title: line.replace(/^scene\s+\d+\s*[:\-]\s*/i, "").slice(0, 72),
      description: line,
      camera: null,
      movement: null,
      transition: null,
      source: "script",
      creates_scene: false,
    });
  }
  return panels;
}

export function composeStoryboardBody(script: string): StoryboardScriptBody {
  return {
    body: script.trim(),
    panels: panelsFromStoryBody(script),
    creates_scene: false,
    creates_canonical: false,
  };
}

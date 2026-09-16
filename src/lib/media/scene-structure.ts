/**
 * Editorial structure labels for canonical Scenes.
 *
 * These are curator-chosen identity, not a new ontology and not Sentinel
 * classification. Sentinel observes visual change. The curator names the
 * window (Intro, Verse 1, Hook, …) and sets start/end before Accept as Scene.
 *
 * Do not infer verse/hook from clock position. That would be a heuristic.
 */

export const SCENE_STRUCTURE_ROLES = [
  { id: "intro", label: "Intro" },
  { id: "verse_1", label: "Verse 1" },
  { id: "hook", label: "Hook" },
  { id: "verse_2", label: "Verse 2" },
  { id: "bridge", label: "Bridge" },
  { id: "verse_3", label: "Verse 3" },
  { id: "outro", label: "Outro" },
  { id: "other", label: "Other" },
] as const;

export type SceneStructureRoleId = (typeof SCENE_STRUCTURE_ROLES)[number]["id"];

export function isSceneStructureRoleId(value: string): value is SceneStructureRoleId {
  return SCENE_STRUCTURE_ROLES.some((role) => role.id === value);
}

export function sceneStructureLabel(roleId: SceneStructureRoleId): string {
  return SCENE_STRUCTURE_ROLES.find((role) => role.id === roleId)?.label ?? "Other";
}

/**
 * Compose the Scene title stored on work_presentation.
 * Role is identity. Custom copy is optional. Sentinel never invents this.
 */
export function composeSceneTitle(
  roleId: SceneStructureRoleId,
  customTitle?: string | null,
): string {
  const role = sceneStructureLabel(roleId);
  const custom = customTitle?.trim() ?? "";
  if (!custom || custom.toLowerCase() === role.toLowerCase()) return role;
  if (roleId === "other") return custom;
  return `${role} — ${custom}`;
}

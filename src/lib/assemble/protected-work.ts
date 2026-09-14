/**
 * Super Hero Ego is the only fully curated live work.
 * Withdraw, reparent, and timing mutation must refuse these ids.
 * MEDIA ≠ CREATIVE WORK — the Mux asset is listed so withdraw cannot
 * treat it as an orphan shell.
 */

export const SUPER_HERO_EGO_UNIVERSE_ID = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
export const SUPER_HERO_EGO_MURAL_ID = "a75ae8af-7b48-4b67-8392-d89447bae370";
export const SUPER_HERO_EGO_MUX_ASSET_ID = "795c057e-2967-4e93-8f5e-06297c674cb0";

export const SUPER_HERO_EGO_SCENE_IDS = [
  "4790c7cf-bb19-4a01-a243-e5c3eb680555",
  "bebb65d2-21ed-4bc9-9fa0-a4857df30a43",
  "df15ec76-6bd8-4956-bbaa-755f72b2b8f8",
  "65490a92-8faf-42ea-a391-0e6473360f5c",
] as const;

export const SUPER_HERO_EGO_MOMENT_IDS = [
  "3b0de6b4-2ca0-43c0-8561-7dc1c0697435",
  "2745a50a-5417-4613-b23b-ef4857ab112e",
  "32422bb4-d03c-465d-8348-942e49ae0051",
] as const;

export const PROTECTED_MASTER_IDS: ReadonlySet<string> = new Set([
  SUPER_HERO_EGO_UNIVERSE_ID,
  SUPER_HERO_EGO_MURAL_ID,
  ...SUPER_HERO_EGO_SCENE_IDS,
  ...SUPER_HERO_EGO_MOMENT_IDS,
]);

export function isProtectedMaster(masterId: string | null | undefined): boolean {
  return Boolean(masterId && PROTECTED_MASTER_IDS.has(masterId));
}

export function isPlayableStorageRef(storageRef: string | null | undefined): boolean {
  if (!storageRef) return false;
  return !storageRef.startsWith("seed:placeholder:");
}

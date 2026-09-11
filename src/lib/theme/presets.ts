export const THEME_PRESETS = [
  { id: "default", label: "Mighty Verse" },
  { id: "soft-pop", label: "Soft Pop" },
  { id: "neo-brutalism", label: "Neo Brutalism" },
  { id: "tangerine", label: "Tangerine" },
] as const;

export type ThemePresetId = (typeof THEME_PRESETS)[number]["id"];

export const THEME_STORAGE_KEY = "mv-theme-preset";

export function isThemePreset(value: string | null | undefined): value is ThemePresetId {
  return THEME_PRESETS.some((preset) => preset.id === value);
}

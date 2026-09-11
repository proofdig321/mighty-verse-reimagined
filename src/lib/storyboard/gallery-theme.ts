/**
 * Gallery artifacts are the visual theme catalogue for storyboard GENERATE.
 * Matching is a creative proposal. It does not create Scenes or retime them.
 */

export type GalleryTheme = {
  asset_id: string;
  title: string;
  role: string;
  still_url: string | null;
};

export const GALLERY_THEME_SYSTEM = `You are assisting a curator inside Mighty Verse Creative Studio.
Match storyboard beats to existing gallery artifacts (visual themes).
Do not invent canonical Scenes. Do not assign database identifiers.
Prefer existing gallery stills over generating new pictures.
Return plain text. When asked for a match, reply with the artifact title only.`;

export function catalogForChrome(themes: GalleryTheme[]): string {
  if (!themes.length) return "No gallery artifacts indexed yet.";
  return themes
    .map((theme) => `- ${theme.title} [${theme.role}]${theme.still_url ? "" : " (no still)"}`)
    .join("\n");
}

export function pickGalleryTheme(
  panel: { title: string; description?: string | null },
  themes: GalleryTheme[],
): GalleryTheme | null {
  const usable = themes.filter((theme) => theme.still_url);
  if (!usable.length) return null;
  const hay = `${panel.title} ${panel.description ?? ""}`.toLowerCase();
  const scored = usable
    .map((theme) => {
      const tokens = `${theme.title} ${theme.role}`
        .toLowerCase()
        .split(/\W+/)
        .filter((token) => token.length > 2);
      const score = tokens.reduce((sum, token) => sum + (hay.includes(token) ? 1 : 0), 0);
      return { theme, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.score ? scored[0].theme : usable[0];
}

export function parseChromeThemeMatch(text: string, themes: GalleryTheme[]): GalleryTheme | null {
  const usable = themes.filter((theme) => theme.still_url);
  if (!usable.length) return null;
  const normalized = text.trim().toLowerCase();
  return (
    usable.find((theme) => normalized.includes(theme.title.toLowerCase())) ??
    usable.find((theme) => normalized.includes(theme.asset_id.toLowerCase())) ??
    null
  );
}

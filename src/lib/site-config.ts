import { getServiceClient } from "@/lib/authority/validate";
import type { HeroConfig } from "@/lib/hero-config";
import { heroConfig as heroDefaults } from "@/lib/hero-config";

const HERO_KEY = "hero";

/**
 * Load hero config from site_config table.
 * Falls back to static defaults if the row doesn't exist yet.
 * Safe to call from server components and API routes.
 */
export async function loadHeroConfig(): Promise<HeroConfig> {
  try {
    const svc = getServiceClient();
    const { data, error } = await svc
      .from("site_config")
      .select("value")
      .eq("key", HERO_KEY)
      .single();
    if (error || !data) return heroDefaults;
    const v = data.value as Partial<HeroConfig>;
    return {
      eyebrow: typeof v.eyebrow === "string" ? v.eyebrow : heroDefaults.eyebrow,
      headline: typeof v.headline === "string" ? v.headline : heroDefaults.headline,
      description: typeof v.description === "string" ? v.description : heroDefaults.description,
      heroMediaId: v.heroMediaId ?? heroDefaults.heroMediaId,
      showTrailerCta: typeof v.showTrailerCta === "boolean" ? v.showTrailerCta : heroDefaults.showTrailerCta,
    };
  } catch {
    return heroDefaults;
  }
}

/**
 * Persist hero config to site_config table (upsert).
 * Call from API routes only — requires service role.
 */
export async function saveHeroConfig(config: HeroConfig): Promise<void> {
  const svc = getServiceClient();
  const { error } = await svc
    .from("site_config")
    .upsert({ key: HERO_KEY, value: config, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

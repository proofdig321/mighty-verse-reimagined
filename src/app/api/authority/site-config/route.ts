import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import { loadHeroConfig, saveHeroConfig } from "@/lib/site-config";
import type { HeroConfig } from "@/lib/hero-config";

async function requireAuthority() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const participantId = await getParticipantId(supabase);
  if (!participantId) return null;
  const svc = getServiceClient();
  const { data } = await svc
    .from("authority_record")
    .select("authority_id")
    .eq("holder_ref", participantId)
    .eq("revoked", false)
    .limit(1)
    .single();
  return data ? participantId : null;
}

export async function GET() {
  const participantId = await requireAuthority();
  if (!participantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const config = await loadHeroConfig();
  return NextResponse.json({ config });
}

export async function PATCH(req: Request) {
  const participantId = await requireAuthority();
  if (!participantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const b = body as Partial<HeroConfig>;
  if (typeof b.eyebrow !== "string" || typeof b.headline !== "string" || typeof b.description !== "string") {
    return NextResponse.json({ error: "eyebrow, headline, and description are required strings" }, { status: 400 });
  }

  const config: HeroConfig = {
    eyebrow: b.eyebrow.trim(),
    headline: b.headline.trim(),
    description: b.description.trim(),
    heroMediaId: typeof b.heroMediaId === "string" && b.heroMediaId ? b.heroMediaId : null,
    textScheme: b.textScheme === "dark" ? "dark" : "light",
    showTrailerCta: typeof b.showTrailerCta === "boolean" ? b.showTrailerCta : true,
  };

  try {
    await saveHeroConfig(config);
    return NextResponse.json({ ok: true, config });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed" }, { status: 500 });
  }
}

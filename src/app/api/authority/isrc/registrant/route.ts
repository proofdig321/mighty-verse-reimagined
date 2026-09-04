import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { validateAuthority, getServiceClient } from "@/lib/authority/validate";
import { PREFIX_PATTERN } from "@/lib/media/isrc";

// GET /api/authority/isrc/registrant
// Returns the active registrant(s) for the ISRC assignment UI.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = getServiceClient();
  const { data, error } = await svc
    .from("isrc_registrant")
    .select("registrant_id, registrant_name, country_code, registrant_code, prefix_code, effective_from, active, notes")
    .order("active", { ascending: false })
    .order("effective_from", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/authority/isrc/registrant
// Body: { registrant_name, prefix_code, country_code?, registrant_code?, effective_from?, notes? }
// Creates a new registrant configuration. Requires platform-level authority.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  // Require platform-level authority (null master_id = platform scope)
  const auth = await validateAuthority(participantId, "create-canonical-state", null);
  if ("error" in auth) {
    return NextResponse.json({ error: "Platform authority required to configure ISRC registrant" }, { status: 403 });
  }

  const { registrant_name, prefix_code, country_code, registrant_code, effective_from, notes } = await request.json();

  if (!registrant_name || !prefix_code) {
    return NextResponse.json({ error: "registrant_name and prefix_code required" }, { status: 400 });
  }

  const normalizedPrefix = prefix_code.toUpperCase().trim();
  if (!PREFIX_PATTERN.test(normalizedPrefix)) {
    return NextResponse.json({
      error: "prefix_code must be exactly 5 uppercase alphanumeric characters (2-letter country code + 3-char registrant code)",
    }, { status: 400 });
  }

  const svc = getServiceClient();

  const { data, error } = await svc
    .from("isrc_registrant")
    .insert({
      registrant_name: registrant_name.trim(),
      prefix_code: normalizedPrefix,
      country_code: country_code?.toUpperCase().trim() ?? null,
      registrant_code: registrant_code?.toUpperCase().trim() ?? null,
      effective_from: effective_from ?? new Date().toISOString().slice(0, 10),
      active: true,
      notes: notes?.trim() ?? null,
      created_by: participantId,
    })
    .select("registrant_id, registrant_name, prefix_code, active")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: `Prefix ${normalizedPrefix} is already registered` }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

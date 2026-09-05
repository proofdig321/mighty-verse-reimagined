import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import { PREFIX_PATTERN } from "@/lib/media/isrc";

// POST /api/authority/isrc/seed
//
// Seeds an ISRC registrant from environment variables if:
//   1. ISRC_REGISTRANT_PREFIX and ISRC_REGISTRANT_NAME are set
//   2. No active registrant already exists in the database
//
// This is the Vercel env-var configuration path. The Authority Dashboard
// UI path (/api/authority/isrc/registrant POST) is the other valid path.
// Both feed the same isrc_registrant table — one canonical source of truth.
//
// Precedence: if an active DB registrant already exists, it takes precedence
// and this route is a no-op. The DB record is always authoritative at runtime.

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const prefixRaw = process.env.ISRC_REGISTRANT_PREFIX;
  const nameRaw = process.env.ISRC_REGISTRANT_NAME;

  if (!prefixRaw || !nameRaw) {
    return NextResponse.json({
      seeded: false,
      reason: "ISRC_REGISTRANT_PREFIX and ISRC_REGISTRANT_NAME environment variables are not set",
    });
  }

  const prefix = prefixRaw.toUpperCase().trim();
  if (!PREFIX_PATTERN.test(prefix)) {
    return NextResponse.json({
      seeded: false,
      reason: `ISRC_REGISTRANT_PREFIX '${prefix}' is not valid (must be 5 uppercase alphanumeric chars: 2-letter country + 3-char registrant code)`,
    });
  }

  const svc = getServiceClient();

  // Check if an active registrant already exists — DB is authoritative
  const { data: existing } = await svc
    .from("isrc_registrant")
    .select("registrant_id, registrant_name, prefix_code")
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      seeded: false,
      reason: "Active registrant already exists in database — DB record takes precedence",
      active: existing,
    });
  }

  // No active registrant — seed from env vars
  const { data, error } = await svc
    .from("isrc_registrant")
    .insert({
      registrant_name: nameRaw.trim(),
      prefix_code: prefix,
      effective_from: new Date().toISOString().slice(0, 10),
      active: true,
      notes: "Seeded from ISRC_REGISTRANT_PREFIX / ISRC_REGISTRANT_NAME environment variables",
      created_by: participantId,
    })
    .select("registrant_id, registrant_name, prefix_code")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to seed registrant" }, { status: 500 });
  }

  return NextResponse.json({ seeded: true, registrant: data }, { status: 201 });
}

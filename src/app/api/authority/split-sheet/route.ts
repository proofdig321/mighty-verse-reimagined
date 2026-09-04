import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { validateAuthority, getServiceClient } from "@/lib/authority/validate";

const VALID_STATUSES = new Set(["draft", "confirmed", "superseded"]);
const VALID_ROLES = new Set([
  "writer", "composer", "lyricist", "producer", "performer",
  "primary_artist", "featured_artist", "director", "publisher",
  "label", "contributor", "other",
]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const {
    realization_id, master_id, applicable = true, not_applicable_reason,
    status = "draft", effective_date, agreement_reference, integrity_hash, notes,
    participants = [],
  } = await request.json();

  if (!realization_id && !master_id) {
    return NextResponse.json({ error: "realization_id or master_id required" }, { status: 400 });
  }
  if (!applicable && !not_applicable_reason) {
    return NextResponse.json({ error: "not_applicable_reason required when applicable is false" }, { status: 400 });
  }
  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (!Array.isArray(participants) || participants.some((p) =>
    typeof p.participant_id !== "string" || !VALID_ROLES.has(p.role)
  )) {
    return NextResponse.json({ error: "Invalid participants array" }, { status: 400 });
  }

  const auth = await validateAuthority(participantId, "create-canonical-state", master_id ?? null);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const svc = getServiceClient();

  const { data: sheet, error: sheetError } = await svc
    .from("media_split_sheet")
    .insert({
      realization_id: realization_id ?? null,
      master_id: master_id ?? null,
      applicable: Boolean(applicable),
      not_applicable_reason: not_applicable_reason?.trim() ?? null,
      status,
      effective_date: effective_date ?? null,
      agreement_reference: agreement_reference?.trim() ?? null,
      integrity_hash: integrity_hash?.trim() ?? null,
      notes: notes?.trim() ?? null,
      created_by: participantId,
    })
    .select("split_sheet_id")
    .single();

  if (sheetError || !sheet) {
    return NextResponse.json({ error: sheetError?.message ?? "Failed to create split sheet" }, { status: 500 });
  }

  if (participants.length > 0) {
    const { error: participantError } = await svc
      .from("media_split_sheet_participant")
      .insert(
        participants.map((p: { participant_id: string; role: string; allocation_pct?: number | null; allocation_notes?: string | null }, i: number) => ({
          split_sheet_id: sheet.split_sheet_id,
          participant_id: p.participant_id,
          role: p.role,
          allocation_pct: p.allocation_pct ?? null,
          allocation_notes: p.allocation_notes?.trim() ?? null,
          display_order: i,
        }))
      );
    if (participantError) {
      return NextResponse.json({ error: `Split sheet created but participants failed: ${participantError.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ split_sheet_id: sheet.split_sheet_id }, { status: 201 });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await getParticipantId(supabase)) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const url = new URL(request.url);
  const realization_id = url.searchParams.get("realization_id");
  const master_id = url.searchParams.get("master_id");

  if (!realization_id && !master_id) {
    return NextResponse.json({ error: "realization_id or master_id required" }, { status: 400 });
  }

  const svc = getServiceClient();
  let query = svc
    .from("media_split_sheet")
    .select("*, media_split_sheet_participant(*)");

  if (realization_id) query = query.eq("realization_id", realization_id);
  else if (master_id) query = query.eq("master_id", master_id);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient, validateAuthority } from "@/lib/authority/validate";

const ISRC_PATTERN = /^[A-Z]{2}-?[A-Z0-9]{3}-?[0-9]{2}-?[0-9]{5}$/;
const WORK_TYPES = new Set(["song", "audio", "video", "animation", "other"]);
const SOURCE_TYPES = new Set(["upload", "external-url", "livepeer-asset", "other"]);
const CREDIT_ROLES = new Set(["primary_artist", "featured_artist", "composer", "lyricist", "producer", "director", "editor", "cinematographer", "performer", "writer", "contributor"]);

function validHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const body = await request.json();
  const {
    master_id,
    asset_id,
    title,
    alternate_title,
    description,
    creator_ref,
    creator_name,
    work_type,
    version_label,
    isrc,
    isrc_status = "not-applicable",
    source_type,
    source_url,
    source_provider,
    external_identifier,
    provenance_notes,
    language,
    genre,
    release_date,
    explicit_content = false,
    visibility = "draft",
    alt_text,
    short_description,
    original_language,
    subgenre,
    version,
    edition,
    original_release_date,
    content_rating,
    search_status = "pending",
    featured = false,
    display_order,
    credits = [],
  } = body;

  if (!title?.trim() || !WORK_TYPES.has(work_type) || !SOURCE_TYPES.has(source_type)) {
    return NextResponse.json({ error: "title, valid work_type, and valid source_type are required" }, { status: 400 });
  }
  if (!['verified', 'not-provided', 'not-applicable'].includes(isrc_status)) {
    return NextResponse.json({ error: "Invalid isrc_status" }, { status: 400 });
  }
  if (isrc_status === "verified" && (typeof isrc !== "string" || !ISRC_PATTERN.test(isrc))) {
    return NextResponse.json({ error: "A valid ISRC is required when isrc_status is verified" }, { status: 400 });
  }
  if (isrc_status !== "verified" && isrc) {
    return NextResponse.json({ error: "ISRC must be omitted unless isrc_status is verified" }, { status: 400 });
  }
  if (source_type === "external-url" && !validHttpsUrl(source_url)) {
    return NextResponse.json({ error: "An HTTPS source_url is required for external sources" }, { status: 400 });
  }
  if (!['draft', 'private', 'public'].includes(visibility)) {
    return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
  }
  if (!['pending', 'indexed', 'excluded'].includes(search_status)) {
    return NextResponse.json({ error: "Invalid search_status" }, { status: 400 });
  }
  if (!Array.isArray(credits) || credits.some((credit) => !credit || typeof credit.participant_id !== "string" || !CREDIT_ROLES.has(credit.role))) {
    return NextResponse.json({ error: "Credits must contain participant_id and a valid role" }, { status: 400 });
  }

  const auth = await validateAuthority(participantId, "create-canonical-state", master_id ?? null);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const svc = getServiceClient();
  const { data, error } = await svc
    .from("media_intake")
    .insert({
      master_id: master_id ?? null,
      asset_id: asset_id ?? null,
      title: title.trim(),
      alternate_title: alternate_title?.trim() || null,
      description: description?.trim() || null,
      short_description: short_description?.trim() || null,
      original_language: original_language?.trim() || null,
      creator_ref: creator_ref ?? null,
      creator_name: creator_name?.trim() || null,
      work_type,
      version_label: version_label?.trim() || null,
      isrc: isrc ?? null,
      isrc_status,
      source_type,
      source_url: source_url ?? null,
      source_provider: source_provider?.trim() || null,
      external_identifier: external_identifier?.trim() || null,
      supplied_by: participantId,
      provenance_notes: provenance_notes?.trim() || null,
      language: language?.trim() || null,
      genre: genre?.trim() || null,
      subgenre: subgenre?.trim() || null,
      version: version?.trim() || null,
      edition: edition?.trim() || null,
      release_date: release_date || null,
      original_release_date: original_release_date || null,
      explicit_content: Boolean(explicit_content),
      content_rating: content_rating?.trim() || null,
      visibility,
      search_status,
      featured: Boolean(featured),
      display_order: Number.isInteger(display_order) ? display_order : null,
      alt_text: alt_text?.trim() || null,
    })
    .select("intake_id, master_id, asset_id, title, work_type, isrc, isrc_status, source_type, source_url, source_provider, supplied_by, created_at")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Failed to create media intake" }, { status: 500 });
  if (credits.length) {
    const { error: creditError } = await svc.from("media_intake_credit").insert(credits.map((credit: { participant_id: string; role: string }, index: number) => ({
      intake_id: data.intake_id,
      participant_id: credit.participant_id,
      role: credit.role,
      display_order: index,
    })));
    if (creditError) return NextResponse.json({ error: `Media intake created, but credits could not be saved: ${creditError.message}` }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

async function authorisedIntakeContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const participantId = await getParticipantId(supabase);
  if (!participantId) return { error: NextResponse.json({ error: "No participant record" }, { status: 403 }) };
  return { participantId, svc: getServiceClient() };
}

export async function GET(request: Request) {
  const context = await authorisedIntakeContext();
  if ("error" in context) return context.error;
  const intakeId = new URL(request.url).searchParams.get("intake_id");
  const query = context.svc.from("media_intake").select("*").order("created_at", { ascending: false });
  const { data, error } = intakeId ? await query.eq("intake_id", intakeId).maybeSingle() : await query.limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const { data: credits } = rows.length
    ? await context.svc.from("media_intake_credit").select("intake_id, participant_id, role, display_order").in("intake_id", rows.map(row => row.intake_id)).order("display_order")
    : { data: [] };
  return NextResponse.json(rows.map(row => ({ ...row, credits: (credits ?? []).filter(credit => credit.intake_id === row.intake_id) })));
}

export async function PATCH(request: Request) {
  const context = await authorisedIntakeContext();
  if ("error" in context) return context.error;
  const body = await request.json();
  const { intake_id, credits = [], ...fields } = body;
  if (typeof intake_id !== "string") return NextResponse.json({ error: "intake_id is required" }, { status: 400 });
  const { data: existingIntake } = await context.svc.from("media_intake").select("master_id").eq("intake_id", intake_id).maybeSingle();
  if (!existingIntake) return NextResponse.json({ error: "Media intake record not found" }, { status: 404 });
  const auth = await validateAuthority(context.participantId, "create-canonical-state", existingIntake.master_id ?? null);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });
  const allowed = ["title", "alternate_title", "description", "short_description", "original_language", "creator_name", "work_type", "version_label", "version", "edition", "language", "genre", "subgenre", "release_date", "original_release_date", "explicit_content", "content_rating", "visibility", "search_status", "featured", "alt_text", "source_type", "source_url", "source_provider", "external_identifier", "isrc", "isrc_status", "provenance_notes"];
  const update = Object.fromEntries(Object.entries(fields).filter(([key]) => allowed.includes(key)));
  if (!update.title || !WORK_TYPES.has(String(update.work_type)) || !SOURCE_TYPES.has(String(update.source_type))) return NextResponse.json({ error: "title, work_type, and source_type are required" }, { status: 400 });
  if (!Array.isArray(credits) || credits.some((credit) => !credit || typeof credit.participant_id !== "string" || !CREDIT_ROLES.has(credit.role))) return NextResponse.json({ error: "Credits contain an invalid participant or role" }, { status: 400 });
  const { error } = await context.svc.from("media_intake").update({ ...update, updated_at: new Date().toISOString() }).eq("intake_id", intake_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { error: deleteError } = await context.svc.from("media_intake_credit").delete().eq("intake_id", intake_id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  if (credits.length) {
    const { error: creditError } = await context.svc.from("media_intake_credit").insert(credits.map((credit: { participant_id: string; role: string }, index: number) => ({ intake_id, participant_id: credit.participant_id, role: credit.role, display_order: index })));
    if (creditError) return NextResponse.json({ error: creditError.message }, { status: 500 });
  }
  return NextResponse.json({ intake_id, updated: true });
}

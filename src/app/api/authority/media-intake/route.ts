import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient, validateAuthority } from "@/lib/authority/validate";

const ISRC_PATTERN = /^[A-Z]{2}-?[A-Z0-9]{3}-?[0-9]{2}-?[0-9]{5}$/;
const WORK_TYPES = new Set(["song", "audio", "video", "animation", "other"]);
const SOURCE_TYPES = new Set(["upload", "external-url", "livepeer-asset", "other"]);

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
      release_date: release_date || null,
      explicit_content: Boolean(explicit_content),
      visibility,
      alt_text: alt_text?.trim() || null,
    })
    .select("intake_id, master_id, asset_id, title, work_type, isrc, isrc_status, source_type, source_url, source_provider, supplied_by, created_at")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Failed to create media intake" }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

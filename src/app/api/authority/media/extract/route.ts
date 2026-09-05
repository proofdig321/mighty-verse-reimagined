import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractFileMetadata, detectIsrcConflict } from "@/lib/media/metadata-extract";

// POST /api/authority/media/extract
// Body: multipart/form-data with field "file" (the media file)
// Optional: "canonical_isrc" (string) — the canonical ISRC to check against
//
// Returns extracted metadata and any ISRC conflict report.
// Called before provider ingestion to detect pre-existing metadata.
// Extracted ISRC is evidence only — never automatically applied to canonical records.

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "file field required" }, { status: 400 });
  }

  // Limit to 50MB for extraction (full upload goes directly to provider)
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large for metadata extraction (max 50MB)" }, { status: 413 });
  }

  const canonicalIsrc = formData.get("canonical_isrc");
  const filename = file instanceof File ? file.name : undefined;
  const mimeType = file.type || null;

  const buffer = Buffer.from(await file.arrayBuffer());
  const extracted = await extractFileMetadata(buffer, mimeType, filename);

  const conflict = detectIsrcConflict(
    extracted,
    typeof canonicalIsrc === "string" ? canonicalIsrc : null
  );

  return NextResponse.json({
    extracted,
    conflict,
    // Guidance for the Authority operator
    guidance: conflict.conflict
      ? "ISRC conflict detected. The uploaded file contains a different ISRC than the canonical record. The operator must resolve this before proceeding."
      : conflict.embeddedIsrc && !conflict.canonicalIsrc
      ? "The uploaded file contains an ISRC. Review and confirm whether this should become the canonical ISRC for this realization."
      : null,
  });
}

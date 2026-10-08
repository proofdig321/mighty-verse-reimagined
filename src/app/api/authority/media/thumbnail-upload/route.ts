import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";

const BUCKET = "creative-artifacts";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

/**
 * POST /api/authority/media/thumbnail-upload
 *
 * Returns a signed upload URL so the browser can PUT the file directly to
 * Supabase Storage. After upload the client calls /api/authority/media/artwork
 * with the resulting public_url.
 *
 * Body: { filename: string; content_type: string; size: number }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId)
    return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  const contentType = typeof body.content_type === "string" ? body.content_type.trim() : "";
  const size = typeof body.size === "number" ? body.size : 0;

  if (!filename) return NextResponse.json({ error: "filename required" }, { status: 400 });
  if (!ALLOWED.includes(contentType))
    return NextResponse.json({ error: "Only JPEG, PNG, and WebP are accepted." }, { status: 400 });
  if (size > MAX_BYTES)
    return NextResponse.json({ error: "File must be under 10 MB." }, { status: 400 });

  const ext = contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
  const path = `thumbnails/${participantId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const svc = getServiceClient();
  const { data: signed, error } = await svc.storage.from(BUCKET).createSignedUploadUrl(path);

  if (error || !signed)
    return NextResponse.json(
      { error: error?.message ?? "Could not create upload URL." },
      { status: 500 },
    );

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const publicUrl = `${projectUrl}/storage/v1/object/public/${BUCKET}/${path}`;

  return NextResponse.json({ signed_url: signed.signedUrl, token: signed.token, path, public_url: publicUrl });
}

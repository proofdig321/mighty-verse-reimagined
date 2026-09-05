import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";

type Params = { params: Promise<{ deckId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { deckId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant" }, { status: 403 });

  const { data: deck, error } = await supabase
    .from("user_deck")
    .select("deck_id, name, created_at, updated_at, user_deck_item(item_id, projection_id, sort_order)")
    .eq("deck_id", deckId)
    .eq("participant_id", participantId)
    .single();

  if (error || !deck) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(deck);
}

export async function PATCH(req: Request, { params }: Params) {
  const { deckId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant" }, { status: 403 });

  const { data: owned } = await supabase
    .from("user_deck").select("deck_id").eq("deck_id", deckId).eq("participant_id", participantId).single();
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { name, items } = body as { name?: string; items?: { projection_id: string; sort_order: number }[] };

  if (name !== undefined) {
    await supabase.from("user_deck").update({ name, updated_at: new Date().toISOString() }).eq("deck_id", deckId);
  }

  if (items !== undefined) {
    await supabase.from("user_deck_item").delete().eq("deck_id", deckId);
    if (items.length > 0) {
      const { error } = await supabase.from("user_deck_item").insert(
        items.map(i => ({ deck_id: deckId, projection_id: i.projection_id, sort_order: i.sort_order }))
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await supabase.from("user_deck").update({ updated_at: new Date().toISOString() }).eq("deck_id", deckId);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { deckId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant" }, { status: 403 });

  await supabase.from("user_deck").delete().eq("deck_id", deckId).eq("participant_id", participantId);
  return NextResponse.json({ ok: true });
}

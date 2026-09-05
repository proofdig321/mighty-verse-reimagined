import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";

// GET /api/decks — list the authenticated user's decks with items
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ decks: [] });

  const { data: decks } = await supabase
    .from("user_deck")
    .select("deck_id, name, created_at, updated_at, user_deck_item(item_id, projection_id, sort_order)")
    .eq("participant_id", participantId)
    .order("updated_at", { ascending: false });

  return NextResponse.json({ decks: decks ?? [] });
}

// POST /api/decks — create a new deck, optionally with initial items
// Body: { name?, items?: { projection_id: string; sort_order: number }[] }
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { name = "My Deck", items = [] } = await request.json().catch(() => ({}));

  const { data: deck, error: deckErr } = await supabase
    .from("user_deck")
    .insert({ participant_id: participantId, name })
    .select("deck_id, name")
    .single();

  if (deckErr || !deck) return NextResponse.json({ error: deckErr?.message ?? "Failed to create deck" }, { status: 500 });

  if (items.length > 0) {
    await supabase.from("user_deck_item").insert(
      items.map((item: { projection_id: string; sort_order: number }) => ({
        deck_id: deck.deck_id,
        projection_id: item.projection_id,
        sort_order: item.sort_order,
      }))
    );
  }

  return NextResponse.json(deck, { status: 201 });
}

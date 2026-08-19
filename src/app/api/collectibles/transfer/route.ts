import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transferCollectible } from "@/lib/collectible/transfer";

// POST /api/collectibles/transfer
// Body: { collectible_id, to_participant_id, transfer_basis, economic_basis? }
// Authenticated or service_role only.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { collectible_id, to_participant_id, transfer_basis, economic_basis } =
      await request.json();

    if (!collectible_id || !to_participant_id || !transfer_basis) {
      return NextResponse.json({ error: "collectible_id, to_participant_id, transfer_basis required" }, { status: 400 });
    }

    const result = await transferCollectible(
      collectible_id,
      to_participant_id,
      transfer_basis,
      economic_basis ?? undefined
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

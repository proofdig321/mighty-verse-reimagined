import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Public fields only — economic_rule_snapshot, entitlement_bundle_id,
// and waterfall internals are never returned to unauthenticated callers.
const PUBLIC_COLUMNS =
  "collectible_id, collectible_class, projection_id, canonical_state_id, master_id, edition_info, issued_at, ownership_rail, web3_token_ref";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ collectibleId: string }> }
) {
  const { collectibleId } = await params;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("collectible")
    .select(PUBLIC_COLUMNS)
    .eq("collectible_id", collectibleId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Collectible not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

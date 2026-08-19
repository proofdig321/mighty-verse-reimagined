import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mintCollectibleToken } from "@/lib/web3/mint";

// POST /api/web3/mint
// Body: { collectible_id, contract_address, to_address, token_id }
// Service-role only — minting is a canonical authority operation.
// A10: failure here does not affect the Web2 collectible record.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serverWalletKey = process.env.SERVER_WALLET_PRIVATE_KEY;
  if (!serverWalletKey) {
    return NextResponse.json({ error: "Server wallet not configured" }, { status: 503 });
  }

  try {
    const { collectible_id, contract_address, to_address, token_id } =
      await request.json();

    if (!collectible_id || !contract_address || !to_address || !token_id) {
      return NextResponse.json({ error: "collectible_id, contract_address, to_address, token_id required" }, { status: 400 });
    }

    const ref = await mintCollectibleToken(
      collectible_id,
      contract_address,
      to_address,
      token_id,
      serverWalletKey
    );

    return NextResponse.json({ ok: true, web3_token_ref: ref });
  } catch (err) {
    // A10: Web3 failure does not cascade to platform failure
    const message = err instanceof Error ? err.message : "Minting failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

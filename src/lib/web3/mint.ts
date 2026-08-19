import { getContract, prepareContractCall, sendTransaction } from "thirdweb";
import { privateKeyAccount } from "thirdweb/wallets";
import { getThirdwebServerClient } from "./client";
import { CHAIN } from "./chain";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type Web3TokenRef = {
  chain: string;
  contract: string;
  token_id: string;
};

// Mint an ERC-721 token for a collectible and write web3_token_ref back.
// A10: Web2 record is authoritative. This is an optional representation rail.
// If minting fails, the collectible record is unaffected — Web2 ownership stands.
export async function mintCollectibleToken(
  collectibleId: string,
  contractAddress: string,
  toAddress: string,
  tokenId: string,
  // Server wallet private key — passed in, never stored in this module
  serverWalletPrivateKey: string
): Promise<Web3TokenRef> {
  const client = getThirdwebServerClient();

  const contract = getContract({
    client,
    chain: CHAIN,
    address: contractAddress,
  });

  // ERC-721 safeMint(address to, uint256 tokenId)
  const transaction = prepareContractCall({
    contract,
    method: "function safeMint(address to, uint256 tokenId)",
    params: [toAddress, BigInt(tokenId)],
  });

  const account = privateKeyAccount({
    client,
    privateKey: serverWalletPrivateKey,
  });

  await sendTransaction({ transaction, account });

  const ref: Web3TokenRef = {
    chain: CHAIN.id.toString(),
    contract: contractAddress,
    token_id: tokenId,
  };

  // Write web3_token_ref onto collectible — the only Web3 annotation per A10
  const supabase = getServiceClient();
  await supabase
    .from("collectible")
    .update({ web3_token_ref: ref })
    .eq("collectible_id", collectibleId);

  return ref;
}

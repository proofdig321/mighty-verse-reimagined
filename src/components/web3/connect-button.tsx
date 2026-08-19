"use client";

import { createThirdwebClient, defineChain } from "thirdweb";
import { ConnectButton } from "thirdweb/react";
import { inAppWallet, createWallet } from "thirdweb/wallets";

// A10: wallet is optional — core platform requires no wallet.
// A13: wallet is an IdentityLink, not the participant identity.

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

const CHAIN = defineChain(
  process.env.NODE_ENV === "production" ? 8453 : 84532
);

const wallets = [
  // In-app wallet: email/social login — no external wallet required per A10
  inAppWallet({
    auth: { options: ["email", "google", "apple"] },
  }),
  createWallet("io.metamask"),
];

export function Web3ConnectButton() {
  return (
    <ConnectButton
      client={client}
      chain={CHAIN}
      wallets={wallets}
      connectModal={{ size: "compact" }}
    />
  );
}

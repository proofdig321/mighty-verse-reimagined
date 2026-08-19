import { defineChain } from "thirdweb";

// A14: Base L2 is the selected chain
export const baseChain = defineChain(8453);        // Base mainnet
export const baseSepoliaChain = defineChain(84532); // Base Sepolia testnet

export const CHAIN = process.env.NODE_ENV === "production" ? baseChain : baseSepoliaChain;

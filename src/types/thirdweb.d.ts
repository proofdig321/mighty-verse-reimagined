// Declaration stubs for thirdweb — package ships without type declarations.
declare module "thirdweb" {
  export const createThirdwebClient: (...args: unknown[]) => unknown;
  export const defineChain: (...args: unknown[]) => unknown;
  export const getContract: (...args: unknown[]) => unknown;
  export const prepareContractCall: (...args: unknown[]) => unknown;
  export const sendTransaction: (...args: unknown[]) => unknown;
  export type ThirdwebClient = unknown;
  export type Chain = unknown;
  export type NFT = unknown;
  export type PreparedTransaction = unknown;
}

declare module "thirdweb/react" {
  import type { ComponentType } from "react";
  export const ThirdwebProvider: ComponentType<{ client: unknown; children?: unknown }>;
  export const ConnectButton: ComponentType<Record<string, unknown>>;
  export const useActiveAccount: () => unknown;
  export const useSendTransaction: () => unknown;
}

declare module "thirdweb/wallets" {
  export const createWallet: (...args: unknown[]) => unknown;
  export const inAppWallet: (...args: unknown[]) => unknown;
  export const privateKeyAccount: (...args: unknown[]) => unknown;
}

import { PublicKey, clusterApiUrl } from "@solana/web3.js";

export type NetworkName = "devnet" | "mainnet-beta";

const devnetRpc =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_SOLANA_RPC_DEVNET
    ? process.env.NEXT_PUBLIC_SOLANA_RPC_DEVNET
    : clusterApiUrl("devnet");
const mainnetRpc =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET
    ? process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET
    : clusterApiUrl("mainnet-beta");

export const NETWORKS: Record<NetworkName, { label: string; endpoint: string }> = {
  devnet: {
    label: "Devnet",
    endpoint: devnetRpc,
  },
  "mainnet-beta": {
    label: "Mainnet",
    endpoint: mainnetRpc,
  },
};

export const DEFAULT_NETWORK: NetworkName =
  (process.env.NEXT_PUBLIC_DEFAULT_NETWORK as NetworkName) || "devnet";

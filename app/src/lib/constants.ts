import { PublicKey, clusterApiUrl } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "B8b7tz681buonvw7mb6rV5CABPy3fTekETea8tdQj8Kb"
);

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

export const DEFAULT_NETWORK: NetworkName = "devnet";

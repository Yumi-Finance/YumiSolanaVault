import { PublicKey, clusterApiUrl } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "1hV5chUTbSWcaGH76TpXq8iCFQrjKPACGF6eD68nT53"
);

export type NetworkName = "devnet" | "mainnet-beta";

export const NETWORKS: Record<NetworkName, { label: string; endpoint: string }> = {
  devnet: {
    label: "Devnet",
    endpoint: clusterApiUrl("devnet"),
  },
  "mainnet-beta": {
    label: "Mainnet",
    endpoint: clusterApiUrl("mainnet-beta"),
  },
};

export const DEFAULT_NETWORK: NetworkName = "devnet";

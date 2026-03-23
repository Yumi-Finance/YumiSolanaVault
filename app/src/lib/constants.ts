import { PublicKey, clusterApiUrl } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "T4PVVqVnC8AxD9FbPEsPnwJkq957RfpwV41ZTLN8Xit"
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

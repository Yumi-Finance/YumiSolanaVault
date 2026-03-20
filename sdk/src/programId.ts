import { PublicKey } from "@solana/web3.js";
import idlJson from "./fixed_vault.json";

export const FIXED_VAULT_PROGRAM_ID = new PublicKey(idlJson.address);

export type ProgramIdInput = PublicKey | string;

export function normalizeProgramId(programId?: ProgramIdInput): PublicKey {
  if (!programId) return FIXED_VAULT_PROGRAM_ID;
  return typeof programId === "string" ? new PublicKey(programId) : programId;
}

import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export const FIXED_VAULT_PROGRAM_ID = new PublicKey(
  "T4PVVqVnC8AxD9FbPEsPnwJkq957RfpwV41ZTLN8Xit"
);

function poolIdToBuffer(poolId: BN | number): Buffer {
  const bn = typeof poolId === "number" ? new BN(poolId) : poolId;
  return bn.toArrayLike(Buffer, "le", 8);
}

export function findConfigPda(
  programId: PublicKey = FIXED_VAULT_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("protocol-config")],
    programId
  );
}

export function findPoolPda(
  poolId: BN | number,
  programId: PublicKey = FIXED_VAULT_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault-pool"), poolIdToBuffer(poolId)],
    programId
  );
}

export function findDepositVaultPda(
  pool: PublicKey,
  programId: PublicKey = FIXED_VAULT_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("deposit-vault"), pool.toBuffer()],
    programId
  );
}

export function findRepayVaultPda(
  pool: PublicKey,
  programId: PublicKey = FIXED_VAULT_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("repay-vault"), pool.toBuffer()],
    programId
  );
}

export function findYieldMintPda(
  pool: PublicKey,
  programId: PublicKey = FIXED_VAULT_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("yield-mint"), pool.toBuffer()],
    programId
  );
}

export function findPermitPda(
  pool: PublicKey,
  user: PublicKey,
  programId: PublicKey = FIXED_VAULT_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("permit"), pool.toBuffer(), user.toBuffer()],
    programId
  );
}

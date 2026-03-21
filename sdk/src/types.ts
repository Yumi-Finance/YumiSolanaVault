import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

/** Parameters for initializing a new vault pool */
export interface InitPoolParams {
  poolId: BN;
  apyBps: number;
  maturityTs: BN;
  depositDeadlineOffset: BN;
  minDepositAmount: BN;
  maxTotalDeposit: BN;
  whitelistEnabled: boolean;
}

/** Parameters for updating an existing pool */
export interface UpdatePoolParams {
  maxTotalDeposit: BN | null;
  minDepositAmount: BN | null;
  apyBps: number | null;
  allowOverpay: boolean | null;
}

/** On-chain ProtocolConfig account data */
export interface ProtocolConfigAccount {
  authority: PublicKey;
  pendingAuthority: PublicKey | null;
  bump: number;
}

/** On-chain VaultPool account data */
export interface VaultPoolAccount {
  poolId: BN;
  depositVault: PublicKey;
  repayVault: PublicKey;
  depositMint: PublicKey;
  yieldMint: PublicKey;
  apyBps: number;
  maturityTs: BN;
  depositDeadlineOffset: BN;
  minDepositAmount: BN;
  maxTotalDeposit: BN;
  totalDeposited: BN;
  totalExpectedReturn: BN;
  totalRepaid: BN;
  remainingRepay: BN;
  totalAdminWithdrawn: BN;
  withdrawalsEnabled: boolean;
  whitelistEnabled: boolean;
  allowOverpay: boolean;
  totalSwept: BN;
  bump: number;
  depositVaultBump: number;
  repayVaultBump: number;
  yieldMintBump: number;
}

/** On-chain DepositPermit account data */
export interface DepositPermitAccount {
  pool: PublicKey;
  user: PublicKey;
  maxAmount: BN;
  amountUsed: BN;
  expiresAt: BN;
  bump: number;
}

/** All PDA addresses for a pool */
export interface PoolAddresses {
  pool: PublicKey;
  poolBump: number;
  depositVault: PublicKey;
  depositVaultBump: number;
  repayVault: PublicKey;
  repayVaultBump: number;
  yieldMint: PublicKey;
  yieldMintBump: number;
}

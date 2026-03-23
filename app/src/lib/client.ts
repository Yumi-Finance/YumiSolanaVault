"use client";

import { AnchorProvider } from "@coral-xyz/anchor";
import { Connection, Transaction, TransactionInstruction } from "@solana/web3.js";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { VaultClient } from "@yumi-finance/vault-sdk";

export class AppVaultClient extends VaultClient {
  constructor(connection: Connection, wallet: AnchorWallet) {
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    super(provider);
  }

  async send(...ixs: TransactionInstruction[]): Promise<string> {
    const tx = new Transaction().add(...ixs);
    return this.provider.sendAndConfirm(tx, []);
  }
}

export { VaultClient } from "@yumi-finance/vault-sdk";
export type {
  VaultPoolAccount,
  ProtocolConfigAccount,
  DepositPermitAccount,
  InitPoolParams,
  UpdatePoolParams,
  PoolAddresses,
} from "@yumi-finance/vault-sdk";
export {
  lamportsToUi,
  uiToLamports,
  shortAddress,
  formatTimestamp,
  poolFillPercent,
  daysToMaturity,
  depositDeadlineTs,
  userExpectedReturn,
  aprBpsToPercent,
  SWEEP_GRACE_SECONDS,
} from "@yumi-finance/vault-sdk";

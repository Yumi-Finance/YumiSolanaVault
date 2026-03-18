/**
 * Депозит в волт — скопируй в свой фронт.
 * Зависимости: @coral-xyz/anchor, @solana/web3.js, @yumi-finance/vault-sdk (или локальный sdk).
 */
import { BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { VaultClient } from "@yumi-finance/vault-sdk";

const PROGRAM_ID = new PublicKey("B8b7tz681buonvw7mb6rV5CABPy3fTekETea8tdQj8Kb");

export type WalletAdapter = {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
};

export function createVaultClient(connection: Connection, wallet: WalletAdapter): VaultClient {
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new VaultClient(provider);
}

/**
 * Депозит в пул. amountUi — сумма в «человеческих» единицах (например 10 = 10 USDC).
 * decimals — количество десятичных знаков токена (USDC = 6).
 */
export async function deposit(
  client: VaultClient,
  userPublicKey: PublicKey,
  poolPubkey: PublicKey,
  amountUi: number,
  decimals: number = 6
): Promise<string> {
  const amount = new BN(Math.floor(amountUi * 10 ** decimals));
  const pool = await client.fetchPool(poolPubkey);
  const permit = pool.whitelistEnabled
    ? client.derivePermitAddress(poolPubkey, userPublicKey)
    : null;

  const ixs = await client.depositIxs(userPublicKey, poolPubkey, amount, permit);
  const tx = new Transaction().add(...ixs);
  return client.provider.sendAndConfirm(tx, []);
}

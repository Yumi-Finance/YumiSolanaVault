# Код депозита в волт для своего фронта

Ниже — минимальный код, чтобы на своём фронте подключать кошелёк и делать депозит в пул волта.

## Зависимости

```json
{
  "@coral-xyz/anchor": "^0.32.1",
  "@solana/spl-token": "^0.4.6",
  "@solana/web3.js": "^1.95.0",
  "bn.js": "^5.2.0"
}
```

Либо подключи пакет волта: `"@yumi-finance/vault-sdk": "file:../YumiSolanaVault/sdk"` (или опубликованную версию).

## Program ID и сеть

**Важно:** program id должен совпадать с той программой, которой принадлежат пулы. Если ты деплоил волт сам (как в этом репо), то id твоей программы — **B8b7tz681buonvw7mb6rV5CABPy3fTekETea8tdQj8Kb**. Если на фронте указать старый id (1hV5ch...), будет ошибка `AccountOwnedByWrongProgram`: пул принадлежит B8b7tz68..., а инструкция уходит в 1hV5ch....

```ts
const PROGRAM_ID = new PublicKey("B8b7tz681buonvw7mb6rV5CABPy3fTekETea8tdQj8Kb");
const DEVNET_RPC = "https://api.devnet.solana.com";
```

## 1. Создание клиента (Connection + Wallet)

Нужны: `Connection` и объект кошелька с `publicKey` и `signTransaction` (например из `@solana/wallet-adapter-react`).

```ts
import { Connection, Transaction, TransactionInstruction } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { VaultClient } from "@yumi-finance/vault-sdk"; // или из своего пути к sdk

// wallet — из useWallet() или useAnchorWallet() (wallet-adapter-react)
function createVaultClient(connection: Connection, wallet: { publicKey: { toBuffer(): Buffer }; signTransaction(tx: Transaction): Promise<Transaction> }) {
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new VaultClient(provider);
}
```

## 2. Отправка транзакции (если не используешь AppVaultClient)

```ts
async function sendTx(
  provider: AnchorProvider,
  ixs: TransactionInstruction[]
): Promise<string> {
  const tx = new Transaction().add(...ixs);
  return provider.sendAndConfirm(tx, []);
}
```

## 3. Список пулов

```ts
const client = createVaultClient(connection, wallet);
const pools = await client.fetchAllPools();
// pools: { pubkey: PublicKey; account: VaultPoolAccount }[]
```

## 4. Депозит в пул (основной код)

Сумма в **наименьших единицах** (для USDC с 6 decimals: 1 USDC = 1_000_000).

```ts
import { BN } from "@coral-xyz/anchor";

async function depositIntoVault(
  client: VaultClient,
  userPublicKey: PublicKey,
  poolPubkey: PublicKey,
  amountUi: number,
  decimals: number = 6
): Promise<string> {
  const amount = new BN(Math.floor(amountUi * 10 ** decimals));

  const pool = await client.fetchPool(poolPubkey);
  const permit =
    pool.whitelistEnabled
      ? client.derivePermitAddress(poolPubkey, userPublicKey)
      : null;

  const ixs = await client.depositIxs(
    userPublicKey,
    poolPubkey,
    amount,
    permit
  );

  const tx = new Transaction().add(...ixs);
  return client.provider.sendAndConfirm(tx, []);
}
```

**Пример вызова (React):**

```ts
// У тебя: connection, wallet (useWallet()), выбранный пул poolPubkey
const client = createVaultClient(connection, wallet);
const signature = await depositIntoVault(
  client,
  wallet.publicKey,
  poolPubkey,
  10  // 10 USDC
);
console.log("Deposit tx:", signature);
```

## 5. Полный пример обработчика кнопки (React)

```ts
const handleDeposit = async () => {
  if (!connection || !wallet?.publicKey || !selectedPoolPubkey) return;
  setLoading(true);
  setError(null);
  try {
    const client = createVaultClient(connection, wallet);
    const amountNum = parseFloat(depositAmountInput); // из инпута, например "10"
    if (isNaN(amountNum) || amountNum <= 0) throw new Error("Invalid amount");

    const sig = await depositIntoVault(
      client,
      wallet.publicKey,
      selectedPoolPubkey,
      amountNum,
      6
    );
    console.log("Success:", sig);
    // обновить балансы / список пулов
  } catch (e) {
    setError(e instanceof Error ? e.message : "Deposit failed");
  } finally {
    setLoading(false);
  }
};
```

## 6. Проверка: можно ли депозитить

```ts
import { VaultClient } from "@yumi-finance/vault-sdk";

const pool = await client.fetchPool(poolPubkey);
const now = new BN(Math.floor(Date.now() / 1000));
const depositOpen = VaultClient.isDepositOpen(
  pool.maturityTs,
  pool.depositDeadlineOffset,
  now
);
const matured = VaultClient.isMatured(pool.maturityTs, now);
// Если depositOpen && !matured — пул принимает депозиты
```

## Итого

- **Клиент:** `AnchorProvider(connection, wallet)` → `new VaultClient(provider)`.
- **Депозит:** `client.depositIxs(user, poolPubkey, amountBn, permit)` → все инструкции в одной транзакции → `provider.sendAndConfirm(tx)`.
- **Сумма:** `BN` в наименьших единицах (для USDC 6 decimals: умножить на 1e6).
- **Whitelist:** если `pool.whitelistEnabled`, передать `client.derivePermitAddress(pool, user)` как `permit`; иначе `null`.

Если не используешь пакет `@yumi-finance/vault-sdk`, нужно будет перенести из этого репо: `sdk/src/client.ts` (VaultClient, depositIxs), `sdk/src/pda.ts`, `sdk/src/types.ts`, `sdk/src/idl.ts`, `sdk/src/fixed_vault.json` и зависимости Anchor + SPL Token.

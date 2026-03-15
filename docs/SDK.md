# @yumi-finance/vault-sdk — SDK Documentation

**Package:** `@yumi-finance/vault-sdk`  
**Version:** 0.1.0  
**Dependencies:** `@coral-xyz/anchor`, `@solana/web3.js`, `@solana/spl-token`

## Installation

```bash
npm install @yumi-finance/vault-sdk
# or link locally:
# "dependencies": { "@yumi-finance/vault-sdk": "file:../sdk" }
```

## Quick Start

```typescript
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { VaultClient, lamportsToUi } from "@yumi-finance/vault-sdk";

const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
const client = new VaultClient(provider);

// Fetch all pools
const pools = await client.fetchAllPools();

// Deposit 100 USDC into a pool
const poolPk = pools[0].pubkey;
const sig = await client.deposit(poolPk, new BN(100_000_000));
```

## Exports

```typescript
// Core client
export { VaultClient } from "./client";

// PDA derivation
export {
  findConfigPda, findPoolPda, findDepositVaultPda,
  findRepayVaultPda, findYieldMintPda, findPermitPda,
  FIXED_VAULT_PROGRAM_ID,
} from "./pda";

// TypeScript types
export {
  InitPoolParams, UpdatePoolParams, VaultPoolAccount,
  ProtocolConfigAccount, DepositPermitAccount, PoolAddresses,
} from "./types";

// Utility functions
export {
  lamportsToUi, uiToLamports, shortAddress, formatTimestamp,
  poolFillPercent, daysToMaturity, depositDeadlineTs,
  userExpectedReturn, apyBpsToPercent,
} from "./utils";

export type { FixedVault } from "./idl";
```

---

## VaultClient

Main class for interacting with the protocol. Wraps an `AnchorProvider`.

```typescript
const client = new VaultClient(provider);
```

### PDA Helpers

| Method | Returns | Description |
|---|---|---|
| `deriveConfigAddress()` | `PublicKey` | ProtocolConfig PDA |
| `derivePoolAddresses(poolId)` | `PoolAddresses` | Pool + all child PDAs (deposit vault, repay vault, yield mint) |
| `derivePermitAddress(pool, user)` | `PublicKey` | DepositPermit PDA |

### Account Fetchers

| Method | Returns | Description |
|---|---|---|
| `fetchConfig(addr?)` | `ProtocolConfigAccount` | Fetch config (throws if missing) |
| `fetchConfigOrNull(addr?)` | `ProtocolConfigAccount \| null` | Fetch config (returns null if missing) |
| `fetchPool(pool)` | `VaultPoolAccount` | Fetch pool data |
| `fetchPoolOrNull(pool)` | `VaultPoolAccount \| null` | Fetch pool (returns null if missing) |
| `fetchPermit(permit)` | `DepositPermitAccount` | Fetch permit |
| `fetchPermitOrNull(permit)` | `DepositPermitAccount \| null` | Fetch permit (returns null) |
| `fetchAllPools()` | `{ pubkey, account }[]` | Fetch all VaultPool accounts |

### Instruction Builders

Return `TransactionInstruction` objects for manual transaction composition.

| Method | Params | Description |
|---|---|---|
| `initConfigIx(authority)` | authority pubkey | Create ProtocolConfig |
| `proposeAuthorityIx(authority, newAuthority)` | current + new | Propose authority transfer |
| `acceptAuthorityIx(newAuthority)` | new authority | Accept authority transfer |
| `initPoolIx(authority, depositMint, params)` | mint + InitPoolParams | Create pool |
| `depositIxs(user, pool, amount, permit?)` | — | **Returns array** — includes ATA creation |
| `withdrawIxs(user, pool, amount)` | — | **Returns array** — includes ATA creation |
| `adminWithdrawIx(authority, pool, amount, adminToken)` | — | Extract capital |
| `repayIx(authority, pool, amount, adminToken)` | — | Return capital |
| `enableWithdrawalsIx(authority, pool)` | — | Enable withdrawals |
| `updatePoolIx(authority, pool, params)` | UpdatePoolParams | Update pool settings |
| `grantPermitIx(authority, pool, user, maxAmount, expiresAt)` | — | Whitelist user |
| `revokePermitIx(authority, pool, permit)` | — | Remove permit |

> **Note:** `depositIxs` and `withdrawIxs` return arrays (include ATA-creation ix). Send all instructions in a single transaction.

### Convenience Methods

Sign and send transactions via the provider wallet. Return the transaction signature.

| Method | Params | Description |
|---|---|---|
| `initConfig()` | — | Init ProtocolConfig |
| `proposeAuthority(newAuthority)` | PublicKey | Propose authority |
| `acceptAuthority()` | — | Accept authority |
| `initPool(depositMint, params)` | PublicKey, InitPoolParams | Create pool |
| `deposit(pool, amount, permit?, user?)` | — | Deposit + ATA creation |
| `withdraw(pool, amount, user?)` | — | Withdraw + ATA creation |
| `adminWithdraw(pool, amount, adminToken)` | — | Admin withdraw |
| `repay(pool, amount, adminToken)` | — | Repay |
| `enableWithdrawals(pool)` | — | Enable withdrawals |
| `updatePool(pool, params)` | — | Update pool |
| `grantPermit(pool, user, maxAmount, expiresAt)` | — | Grant permit |
| `revokePermit(pool, permit)` | — | Revoke permit |

### Static Utilities

| Method | Returns | Description |
|---|---|---|
| `VaultClient.calcExpectedReturn(amount, apyBps, maturityTs, nowTs)` | `BN` | Calculate yToken amount for a deposit |
| `VaultClient.isMatured(maturityTs, nowTs?)` | `boolean` | Check if pool has matured |
| `VaultClient.isDepositOpen(maturityTs, deadlineOffset, nowTs?)` | `boolean` | Check if deposits are still accepted |

---

## PDA Functions

Standalone PDA derivation (no client needed). All accept an optional `programId` parameter (defaults to `FIXED_VAULT_PROGRAM_ID`).

```typescript
import { findPoolPda, findPermitPda, FIXED_VAULT_PROGRAM_ID } from "@yumi-finance/vault-sdk";

const [poolPda, bump] = findPoolPda(1);           // pool_id = 1
const [permit, _] = findPermitPda(poolPda, userPk);
```

| Function | Seeds |
|---|---|
| `findConfigPda()` | `["protocol-config"]` |
| `findPoolPda(poolId)` | `["vault-pool", poolId (8 bytes LE)]` |
| `findDepositVaultPda(pool)` | `["deposit-vault", pool]` |
| `findRepayVaultPda(pool)` | `["repay-vault", pool]` |
| `findYieldMintPda(pool)` | `["yield-mint", pool]` |
| `findPermitPda(pool, user)` | `["permit", pool, user]` |

---

## Utility Functions

### Formatting

```typescript
import { lamportsToUi, uiToLamports, shortAddress, formatTimestamp, apyBpsToPercent } from "@yumi-finance/vault-sdk";

lamportsToUi(new BN(1_500_000), 6);     // "1.500000"
uiToLamports("1.5", 6);                 // BN(1500000)
shortAddress(somePubkey);                // "7xKX...9fG3"
shortAddress(somePubkey, 6);             // "7xKXab...v29fG3"
formatTimestamp(new BN(1710000000));      // "Mar 9, 2024, 12:00 PM"
apyBpsToPercent(850);                    // "8.50"
```

### Pool Analytics

```typescript
import { poolFillPercent, daysToMaturity, depositDeadlineTs } from "@yumi-finance/vault-sdk";

poolFillPercent(pool);           // 75.5 (percent filled)
daysToMaturity(pool.maturityTs); // 45 (days remaining, 0 if matured)
depositDeadlineTs(pool);         // BN timestamp or null
```

### User Position

```typescript
import { userExpectedReturn } from "@yumi-finance/vault-sdk";

// Before withdrawals enabled: returns yToken balance (= principal + interest)
// After withdrawals enabled:  returns yBalance × totalRepaid / totalExpectedReturn
const expected = userExpectedReturn(userYieldBalance, pool);
// BN amount or null (if balance is zero)
```

The repayment ratio `totalRepaid / totalExpectedReturn` is stable regardless of how many users have already withdrawn — it reflects the actual percentage the admin has repaid.

---

## Types

### InitPoolParams

```typescript
interface InitPoolParams {
  poolId: BN;
  apyBps: number;               // basis points (800 = 8%)
  maturityTs: BN;                // unix timestamp
  depositDeadlineOffset: BN;     // seconds before maturity (0 = no early cutoff)
  minDepositAmount: BN;          // smallest units
  maxTotalDeposit: BN;           // smallest units
  whitelistEnabled: boolean;
}
```

### UpdatePoolParams

```typescript
interface UpdatePoolParams {
  maxTotalDeposit: BN | null;    // null = no change
  minDepositAmount: BN | null;
  apyBps: number | null;
}
```

### VaultPoolAccount

```typescript
interface VaultPoolAccount {
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
  bump: number;
  depositVaultBump: number;
  repayVaultBump: number;
  yieldMintBump: number;
}
```

### ProtocolConfigAccount

```typescript
interface ProtocolConfigAccount {
  authority: PublicKey;
  pendingAuthority: PublicKey | null;
  bump: number;
}
```

### DepositPermitAccount

```typescript
interface DepositPermitAccount {
  pool: PublicKey;
  user: PublicKey;
  maxAmount: BN;
  amountUsed: BN;
  expiresAt: BN;
  bump: number;
}
```

### PoolAddresses

```typescript
interface PoolAddresses {
  pool: PublicKey;
  poolBump: number;
  depositVault: PublicKey;
  depositVaultBump: number;
  repayVault: PublicKey;
  repayVaultBump: number;
  yieldMint: PublicKey;
  yieldMintBump: number;
}
```

---

## Usage Examples

### Full Pool Lifecycle (Admin)

```typescript
const client = new VaultClient(provider);

// 1. Initialize protocol
await client.initConfig();

// 2. Create a pool
await client.initPool(usdcMint, {
  poolId: new BN(1),
  apyBps: 800,
  maturityTs: new BN(Math.floor(Date.now() / 1000) + 90 * 86400), // 90 days
  depositDeadlineOffset: new BN(7 * 86400), // close deposits 7 days before maturity
  minDepositAmount: new BN(1_000_000),     // 1 USDC
  maxTotalDeposit: new BN(1_000_000_000_000), // 1M USDC
  whitelistEnabled: false,
});

// 3. After users deposit — extract capital
const poolAddrs = client.derivePoolAddresses(1);
const adminAta = getAssociatedTokenAddressSync(usdcMint, provider.wallet.publicKey);
await client.adminWithdraw(poolAddrs.pool, new BN(500_000_000_000), adminAta);

// 4. Repay capital + yield
await client.repay(poolAddrs.pool, new BN(510_000_000_000), adminAta);

// 5. Enable withdrawals (after maturity)
await client.enableWithdrawals(poolAddrs.pool);
```

### User Deposit & Withdraw

```typescript
const client = new VaultClient(provider);
const pools = await client.fetchAllPools();
const pool = pools[0];

// Deposit 100 USDC
await client.deposit(pool.pubkey, new BN(100_000_000));

// ... wait for maturity + withdrawals enabled ...

// Withdraw all yTokens
const yBalance = /* fetch from token account */;
await client.withdraw(pool.pubkey, yBalance);
```

### Using Instruction Builders (Custom Transactions)

```typescript
const depositIxs = await client.depositIxs(userPk, poolPk, amount, permitPk);
const tx = new Transaction().add(...depositIxs);
await provider.sendAndConfirm(tx);
```

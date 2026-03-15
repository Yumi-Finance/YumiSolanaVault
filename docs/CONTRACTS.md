# Yumi Fixed Vault — Smart Contract Documentation

**Program ID:** `1hV5chUTbSWcaGH76TpXq8iCFQrjKPACGF6eD68nT53`  
**Framework:** Anchor 0.32.1  
**Network:** Solana (Devnet / Mainnet)

## Overview

Fixed-rate, fixed-term vault protocol. Users deposit USDC into pools with a fixed APY and maturity date, receive yTokens representing their claim (principal + interest). The protocol admin deploys the capital, repays into a separate vault, then enables withdrawals at maturity. Payout is proportional to the user's share of the total yToken supply.

## Protocol Flow

```
1. init_config           — Bootstrap authority creates ProtocolConfig
2. propose/accept_authority — Two-step authority transfer (optional)
3. init_pool             — Authority creates a pool (APY, maturity, cap)
4. grant_permit          — Authority whitelists users (if whitelist enabled)
5. deposit               — Users deposit USDC → receive yTokens
6. admin_withdraw        — Authority extracts capital from deposit vault
   ↕ update_pool         — Authority adjusts cap / min deposit / APY
7. repay                 — Authority returns USDC into repay vault
8. enable_withdrawals    — Authority enables user withdrawals post-maturity
9. withdraw              — Users burn yTokens → receive proportional payout
```

## Accounts

### ProtocolConfig

Singleton. Holds the protocol admin authority.

| Field | Type | Description |
|---|---|---|
| `authority` | `Pubkey` | Current protocol admin |
| `pending_authority` | `Option<Pubkey>` | Staged authority for two-step transfer |
| `bump` | `u8` | PDA bump |

**PDA seeds:** `["protocol-config"]`

### VaultPool

One per pool. Holds all pool configuration and accounting state.

| Field | Type | Description |
|---|---|---|
| `pool_id` | `u64` | Unique pool identifier |
| `deposit_vault` | `Pubkey` | Token account PDA holding user deposits |
| `repay_vault` | `Pubkey` | Token account PDA holding admin repayments |
| `deposit_mint` | `Pubkey` | SPL token mint (e.g. USDC) |
| `yield_mint` | `Pubkey` | yToken mint PDA |
| `apy_bps` | `u16` | APY in basis points (e.g. 800 = 8%) |
| `maturity_ts` | `i64` | Unix timestamp when pool matures |
| `deposit_deadline_offset` | `u64` | Seconds before maturity when deposits close (0 = at maturity) |
| `min_deposit_amount` | `u64` | Minimum deposit per transaction |
| `max_total_deposit` | `u64` | Pool capacity cap |
| `total_deposited` | `u64` | Cumulative deposits (monotonically increasing) |
| `total_expected_return` | `u64` | Total outstanding yToken liability |
| `total_repaid` | `u64` | Cumulative amount repaid by admin (monotonically increasing) |
| `remaining_repay` | `u64` | Current repay vault balance available for withdrawals |
| `total_admin_withdrawn` | `u64` | Cumulative admin withdrawals from deposit vault |
| `withdrawals_enabled` | `bool` | Whether user withdrawals are open |
| `whitelist_enabled` | `bool` | Whether deposits require a permit |
| `bump` | `u8` | Pool PDA bump |
| `deposit_vault_bump` | `u8` | Deposit vault PDA bump |
| `repay_vault_bump` | `u8` | Repay vault PDA bump |
| `yield_mint_bump` | `u8` | Yield mint PDA bump |

**PDA seeds:** `["vault-pool", pool_id (8 bytes LE)]`

### DepositPermit

Per-user, per-pool whitelist entry with cumulative deposit tracking.

| Field | Type | Description |
|---|---|---|
| `pool` | `Pubkey` | Pool this permit belongs to |
| `user` | `Pubkey` | Permitted user |
| `max_amount` | `u64` | Cumulative deposit cap (0 = unlimited) |
| `amount_used` | `u64` | Amount already deposited under this permit |
| `expires_at` | `i64` | Unix expiry (0 = no expiry) |
| `bump` | `u8` | PDA bump |

**PDA seeds:** `["permit", pool_pubkey, user_pubkey]`

### Token Account PDAs

| Account | Seeds |
|---|---|
| Deposit Vault | `["deposit-vault", pool_pubkey]` |
| Repay Vault | `["repay-vault", pool_pubkey]` |
| Yield Mint | `["yield-mint", pool_pubkey]` |

## Instructions

### init_config

Creates the singleton `ProtocolConfig`. Can only be called by the hardcoded `BOOTSTRAP_AUTHORITY`.

### propose_authority(new_authority)

Sets `pending_authority`. First step of the two-step authority transfer.

- **Access:** Current `config.authority`

### accept_authority

Promotes `pending_authority` to `authority` and clears `pending_authority`.

- **Access:** The `pending_authority` wallet must sign.

### init_pool(params)

Creates a new `VaultPool` with three child PDAs (deposit vault, repay vault, yield mint).

- **Access:** `config.authority`
- **Params:**

| Param | Type | Description |
|---|---|---|
| `pool_id` | `u64` | Unique pool ID |
| `apy_bps` | `u16` | APY in basis points |
| `maturity_ts` | `i64` | Must be in the future |
| `deposit_deadline_offset` | `u64` | Seconds before maturity to close deposits |
| `min_deposit_amount` | `u64` | Minimum deposit amount |
| `max_total_deposit` | `u64` | Pool capacity |
| `whitelist_enabled` | `bool` | Require permits for deposits |

### deposit(amount)

User deposits tokens and receives yTokens. The yToken amount includes pro-rated interest:

```
yield = principal + (principal × apy_bps × seconds_to_maturity) / (10_000 × 365 × 86400)
```

- **Access:** Any user (or whitelisted user if `whitelist_enabled`)
- **Checks:**
  - Deposit deadline not passed
  - Pool not matured
  - `amount >= min_deposit_amount`
  - `total_deposited + amount <= max_total_deposit`
  - Permit valid (if whitelist enabled): pool match, user match, expiry, cumulative cap

### admin_withdraw(amount)

Admin extracts deposited capital for deployment.

- **Access:** `config.authority`
- **Constraint:** `amount <= total_deposited - total_admin_withdrawn`

### repay(amount)

Admin returns capital (principal + yield) into the repay vault.

- **Access:** `config.authority`
- **Constraint:** Cannot be called after `withdrawals_enabled = true`

### enable_withdrawals

One-way flag — enables user withdrawals.

- **Access:** `config.authority`
- **Constraints:**
  - `now >= maturity_ts`
  - `remaining_repay > 0`

### withdraw(amount)

User burns yTokens and receives proportional payout from the repay vault.

```
payout = (user_yTokens × remaining_repay) / yield_mint_supply
```

If the user is the last withdrawer (`amount == supply`), they receive the entire `remaining_repay` to avoid rounding dust.

- **Access:** Any yToken holder
- **Constraints:**
  - `now >= maturity_ts`
  - `withdrawals_enabled == true`

### update_pool(params)

Selectively update pool parameters.

- **Access:** `config.authority`
- **Params:** `max_total_deposit`, `min_deposit_amount`, `apy_bps` — all optional
- **Constraint:** New `max_total_deposit` must be `>= total_deposited`

### grant_permit(user, max_amount, expires_at)

Whitelist a user for deposits on a specific pool.

- **Access:** `config.authority`

### revoke_permit

Close a deposit permit (refunds rent to authority).

- **Access:** `config.authority`

## Error Codes

| Error | Description |
|---|---|
| `DepositTooSmall` | Deposit amount is below the minimum |
| `PoolCapExceeded` | Deposit would exceed the pool cap |
| `MaturityNotReached` | Maturity date has not been reached yet |
| `DepositDeadlinePassed` | Deposit deadline has passed |
| `CapBelowActive` | New cap cannot be below current total deposits |
| `MathOverflow` | Arithmetic overflow |
| `NotWhitelisted` | Deposit requires a valid whitelist permit |
| `PermitExpired` | Deposit permit has expired |
| `WithdrawalsNotEnabled` | Withdrawals are not enabled yet |
| `RepayAfterWithdrawalsEnabled` | Cannot repay after withdrawals have been enabled |
| `Unauthorized` | Only the protocol authority can perform this action |
| `AdminWithdrawExceeded` | Admin withdraw exceeds available balance |
| `NoRepayToDistribute` | Cannot enable withdrawals with no repay funds |
| `NoPendingAuthority` | No pending authority to accept |
| `PermitLimitExceeded` | Cumulative deposit exceeds permit limit |
| `InvalidMaturity` | Maturity timestamp must be in the future |

## Security Model

- **Two-step authority transfer** — prevents accidental loss of admin access
- **Cumulative permit tracking** — users cannot exceed their allocated deposit limit across multiple deposits
- **Separate deposit/repay vaults** — deposited capital and repaid capital are isolated
- **Maturity enforcement** — withdrawals and enable_withdrawals require `now >= maturity_ts`
- **Admin withdraw cap** — admin cannot withdraw more than was deposited
- **Repay lock** — repay is blocked once withdrawals are enabled (prevents accounting inconsistencies)
- **Last-withdrawer dust protection** — final user receives entire remaining balance

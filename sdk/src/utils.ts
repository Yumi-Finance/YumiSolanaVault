import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { VaultPoolAccount } from "./types";

/** Grace period after maturity before admin can sweep orphaned repay funds (180 days in seconds). */
export const SWEEP_GRACE_SECONDS = 180 * 24 * 3600;

/** Maximum allowed APR in basis points (4000 bps = 40%). */
export const MAX_APR_BPS = 4000;

/** Format a BN amount (in smallest units) to a human-readable decimal string. */
export function lamportsToUi(val: BN, decimals: number): string {
  const s = val.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals) || "0";
  const frac = s.slice(s.length - decimals);
  return `${whole}.${frac}`;
}

/** Parse a human-readable decimal string to BN (smallest units). */
export function uiToLamports(val: string, decimals: number): BN {
  const [whole = "0", frac = ""] = val.split(".");
  const paddedFrac = frac.slice(0, decimals).padEnd(decimals, "0");
  return new BN(whole + paddedFrac);
}

/** Shorten a PublicKey to "xxxx...xxxx" format. */
export function shortAddress(pk: PublicKey, chars: number = 4): string {
  const s = pk.toBase58();
  return s.slice(0, chars) + "..." + s.slice(-chars);
}

/** Format a unix-timestamp BN to a locale date string. */
export function formatTimestamp(ts: BN): string {
  return new Date(ts.toNumber() * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Pool capacity fill percentage (0–100). */
export function poolFillPercent(pool: VaultPoolAccount): number {
  const cap = pool.maxTotalDeposit.toNumber();
  if (cap <= 0) return 0;
  return Math.min((pool.totalDeposited.toNumber() / cap) * 100, 100);
}

/** Days until pool maturity (0 if already matured). */
export function daysToMaturity(maturityTs: BN, nowTs?: BN): number {
  const now = nowTs ?? new BN(Math.floor(Date.now() / 1000));
  const secs = maturityTs.sub(now).toNumber();
  return Math.max(0, Math.ceil(secs / 86400));
}

/** Deposit deadline timestamp, or null if there's no deadline offset. */
export function depositDeadlineTs(pool: VaultPoolAccount): BN | null {
  if (pool.depositDeadlineOffset.eqn(0)) return null;
  return pool.maturityTs.sub(pool.depositDeadlineOffset);
}

/**
 * Compute user's expected return given their yToken balance and pool state.
 *
 * - Before withdrawals enabled: yToken balance (yTokens already include interest at mint time).
 * - After withdrawals enabled: `yTokenBalance * totalRepaid / totalExpectedReturn`
 *   (stable repayment ratio independent of how many users have already withdrawn).
 *
 * Returns null if yieldBalance is zero or null.
 */
export function userExpectedReturn(
  yieldBalance: BN | null,
  pool: VaultPoolAccount
): BN | null {
  if (!yieldBalance || yieldBalance.isZero()) return null;
  if (pool.withdrawalsEnabled && pool.totalExpectedReturn.gtn(0)) {
    return yieldBalance.mul(pool.totalRepaid).div(pool.totalExpectedReturn);
  }
  return yieldBalance;
}

/** APR in basis points formatted as a percentage string (e.g. "12.50"). */
export function aprBpsToPercent(bps: number): string {
  return (bps / 100).toFixed(2);
}

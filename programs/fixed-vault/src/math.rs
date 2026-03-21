use crate::errors::VaultError;
use anchor_lang::prelude::*;

/// Compute the yToken mint amount for a deposit.
///
/// Formula: principal + (principal × apy_bps × duration_secs) / 315_360_000_000
/// where 315_360_000_000 = 10_000 × 365 × 24 × 3600 (BPS_BASE × SECONDS_PER_YEAR)
///
/// All intermediate arithmetic is in u128 to prevent overflow.
/// The final value is checked with `try_from` — returns `MathOverflow` if it
/// does not fit in u64, rather than silently truncating.
pub fn calc_expected_return(amount: u64, apy_bps: u16, duration_secs: u64) -> Result<u64> {
    let interest = (amount as u128)
        .checked_mul(apy_bps as u128)
        .ok_or(VaultError::MathOverflow)?
        .checked_mul(duration_secs as u128)
        .ok_or(VaultError::MathOverflow)?
        .checked_div(315_360_000_000u128) // 10_000 * 365 * 24 * 3600
        .ok_or(VaultError::MathOverflow)?;

    let total = (amount as u128)
        .checked_add(interest)
        .ok_or(VaultError::MathOverflow)?;

    u64::try_from(total).map_err(|_| error!(VaultError::MathOverflow))
}

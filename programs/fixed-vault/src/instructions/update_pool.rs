use anchor_lang::prelude::*;

use crate::errors::VaultError;
use crate::math::calc_expected_return;
use crate::state::{ProtocolConfig, VaultPool};
use crate::MAX_APR_BPS;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdatePoolParams {
    pub max_total_deposit: Option<u64>,
    pub min_deposit_amount: Option<u64>,
    pub apr_bps: Option<u16>,
    pub allow_overpay: Option<bool>,
}

#[derive(Accounts)]
pub struct UpdatePool<'info> {
    #[account(
        constraint = authority.key() == config.authority @ VaultError::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(seeds = [b"protocol-config"], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [b"vault-pool" as &[u8], &pool.pool_id.to_le_bytes()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, VaultPool>,
}

pub fn handle_update_pool(ctx: Context<UpdatePool>, params: UpdatePoolParams) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    if let Some(max_total_deposit) = params.max_total_deposit {
        require!(max_total_deposit >= pool.total_deposited, VaultError::CapBelowActive);
        pool.max_total_deposit = max_total_deposit;
    }
    if let Some(min_deposit_amount) = params.min_deposit_amount {
        pool.min_deposit_amount = min_deposit_amount;
    }
    if let Some(apr_bps) = params.apr_bps {
        require!(apr_bps <= MAX_APR_BPS, VaultError::AprTooHigh);
        pool.apr_bps = apr_bps;
    }
    if let Some(allow_overpay) = params.allow_overpay {
        // allow_overpay is a one-way flag — once enabled it cannot be revoked.
        require!(allow_overpay || !pool.allow_overpay, VaultError::CannotRevokeOverpay);
        pool.allow_overpay = allow_overpay;
    }

    // Dry-run worst-case yield computation after any change to cap or APY.
    // Ensures no individual deposit can ever cause a u64 overflow in calc_expected_return.
    let now = Clock::get()?.unix_timestamp;
    let duration_secs = pool.maturity_ts.saturating_sub(now).max(0) as u64;
    calc_expected_return(pool.max_total_deposit, pool.apr_bps, duration_secs)?;

    Ok(())
}

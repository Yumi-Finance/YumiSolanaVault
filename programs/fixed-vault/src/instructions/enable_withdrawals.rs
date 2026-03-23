use anchor_lang::prelude::*;

use crate::errors::VaultError;
use crate::events::EnableWithdrawalsEvent;
use crate::state::{ProtocolConfig, VaultPool};

#[derive(Accounts)]
pub struct EnableWithdrawals<'info> {
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

pub fn handle_enable_withdrawals(ctx: Context<EnableWithdrawals>) -> Result<()> {    let now = Clock::get()?.unix_timestamp;
    require!(
        now >= ctx.accounts.pool.maturity_ts,
        VaultError::MaturityNotReached
    );
    require!(
        ctx.accounts.pool.remaining_repay > 0,
        VaultError::NoRepayToDistribute
    );
    ctx.accounts.pool.withdrawals_enabled = true;

    emit!(EnableWithdrawalsEvent {
        pool: ctx.accounts.pool.key(),
        authority: ctx.accounts.authority.key(),
        total_repaid: ctx.accounts.pool.total_repaid,
        total_expected_return: ctx.accounts.pool.total_expected_return,
        ts: now,
    });

    Ok(())
}

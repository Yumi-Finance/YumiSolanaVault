use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::VaultError;
use crate::state::{ProtocolConfig, VaultPool};

/// Grace period after maturity before admin can sweep orphaned repay funds (180 days).
pub const SWEEP_GRACE_SECONDS: i64 = 15_552_000; // 180 * 24 * 3600

#[derive(Accounts)]
pub struct SweepRepayVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"protocol-config"],
        bump = config.bump,
        has_one = authority @ VaultError::Unauthorized,
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [b"vault-pool" as &[u8], &pool.pool_id.to_le_bytes()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, VaultPool>,

    #[account(
        mut,
        address = pool.repay_vault,
    )]
    pub repay_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = pool.deposit_mint,
        token::authority = authority,
    )]
    pub admin_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_sweep_repay_vault(ctx: Context<SweepRepayVault>) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let now = Clock::get()?.unix_timestamp;

    // Must have withdrawals enabled (normal flow completed)
    require!(pool.withdrawals_enabled, VaultError::WithdrawalsNotEnabled);

    // Must be past maturity + grace period
    let sweep_after = pool
        .maturity_ts
        .checked_add(SWEEP_GRACE_SECONDS)
        .ok_or(VaultError::MathOverflow)?;
    require!(now >= sweep_after, VaultError::SweepGracePeriodNotElapsed);

    let amount = ctx.accounts.repay_vault.amount;
    require!(amount > 0, VaultError::NothingToSweep);

    let pool_id_bytes = pool.pool_id.to_le_bytes();
    let seeds: &[&[u8]] = &[b"vault-pool", &pool_id_bytes, &[pool.bump]];
    let signer_seeds = &[seeds];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.repay_vault.to_account_info(),
                to: ctx.accounts.admin_token_account.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    let pool = &mut ctx.accounts.pool;
    pool.total_swept = pool.remaining_repay;
    pool.remaining_repay = 0;

    Ok(())
}

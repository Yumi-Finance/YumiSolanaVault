use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::VaultError;
use crate::events::RepayEvent;
use crate::state::{ProtocolConfig, VaultPool};

#[derive(Accounts)]
pub struct Repay<'info> {
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
        token::mint = pool.deposit_mint,
        token::authority = authority,
    )]
    pub admin_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        address = pool.repay_vault,
    )]
    pub repay_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_repay(ctx: Context<Repay>, amount: u64) -> Result<()> {
    require!(!ctx.accounts.pool.withdrawals_enabled, VaultError::RepayAfterWithdrawalsEnabled);
    require!(ctx.accounts.pool.total_expected_return > 0, VaultError::NoRepayToDistribute);
    if !ctx.accounts.pool.allow_overpay {
        require!(
            ctx.accounts.pool.total_repaid.checked_add(amount).ok_or(VaultError::MathOverflow)?
                <= ctx.accounts.pool.total_expected_return,
            VaultError::RepayExceedsCap
        );
    }

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.admin_token_account.to_account_info(),
                to: ctx.accounts.repay_vault.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        ),
        amount,
    )?;

    let pool = &mut ctx.accounts.pool;
    pool.total_repaid = pool
        .total_repaid
        .checked_add(amount)
        .ok_or(VaultError::MathOverflow)?;
    pool.remaining_repay = pool
        .remaining_repay
        .checked_add(amount)
        .ok_or(VaultError::MathOverflow)?;

    emit!(RepayEvent {
        pool: pool.key(),
        authority: ctx.accounts.authority.key(),
        amount,
        total_repaid: pool.total_repaid,
        remaining_repay: pool.remaining_repay,
        ts: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

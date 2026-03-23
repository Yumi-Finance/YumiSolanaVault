use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};

use crate::errors::VaultError;
use crate::events::WithdrawEvent;
use crate::state::VaultPool;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault-pool" as &[u8], &pool.pool_id.to_le_bytes()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, VaultPool>,

    #[account(
        mut,
        address = pool.yield_mint,
    )]
    pub yield_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = user_yield_account.mint == pool.yield_mint,
        constraint = user_yield_account.owner == user.key(),
    )]
    pub user_yield_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        address = pool.repay_vault,
    )]
    pub repay_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token_account.mint == pool.deposit_mint,
        constraint = user_token_account.owner == user.key(),
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    require!(amount > 0, VaultError::WithdrawalTooSmall);
    let clock = Clock::get()?;
    require!(clock.unix_timestamp >= ctx.accounts.pool.maturity_ts, VaultError::MaturityNotReached);
    require!(ctx.accounts.pool.withdrawals_enabled, VaultError::WithdrawalsNotEnabled);
    require!(ctx.accounts.pool.remaining_repay > 0, VaultError::NoRepayRemaining);

    let pool_id = ctx.accounts.pool.pool_id;
    let pool_bump = ctx.accounts.pool.bump;
    let remaining_repay = ctx.accounts.pool.remaining_repay;

    // Calculate proportional payout BEFORE burning (supply still includes user's tokens)
    let supply = ctx.accounts.yield_mint.supply;
    let payout = if amount == supply {
        // Last withdrawer gets everything remaining — avoids rounding dust
        remaining_repay
    } else {
        (amount as u128)
            .checked_mul(remaining_repay as u128)
            .ok_or(VaultError::MathOverflow)?
            .checked_div(supply as u128)
            .ok_or(VaultError::MathOverflow)? as u64
    };

    // Burn yTokens
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.yield_mint.to_account_info(),
                from: ctx.accounts.user_yield_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;

    // Transfer proportional USDC from repay_vault to user
    let pool_id_bytes = pool_id.to_le_bytes();
    let seeds: &[&[u8]] = &[
        b"vault-pool",
        &pool_id_bytes,
        &[pool_bump],
    ];
    let signer_seeds = &[seeds];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.repay_vault.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            signer_seeds,
        ),
        payout,
    )?;

    // Update pool state — only remaining_repay decreases; total_repaid and total_expected_return stay frozen
    let pool = &mut ctx.accounts.pool;
    pool.remaining_repay = pool
        .remaining_repay
        .checked_sub(payout)
        .ok_or(VaultError::MathOverflow)?;

    emit!(WithdrawEvent {
        pool: pool.key(),
        user: ctx.accounts.user.key(),
        y_tokens_burned: amount,
        payout,
        remaining_repay: pool.remaining_repay,
        ts: clock.unix_timestamp,
    });

    Ok(())
}

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};

use crate::errors::VaultError;
use crate::events::DepositEvent;
use crate::math::calc_expected_return;
use crate::state::{DepositPermit, VaultPool};

#[derive(Accounts)]
pub struct Deposit<'info> {
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
        constraint = user_token_account.mint == pool.deposit_mint,
        constraint = user_token_account.owner == user.key(),
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        address = pool.deposit_vault,
    )]
    pub deposit_vault: Account<'info, TokenAccount>,

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

    /// Optional: deposit permit (required when pool.whitelist_enabled)
    #[account(mut)]
    pub permit: Option<Account<'info, DepositPermit>>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    // Save pool fields before mutable borrow
    let pool_id = ctx.accounts.pool.pool_id;
    let pool_bump = ctx.accounts.pool.bump;
    let maturity_ts = ctx.accounts.pool.maturity_ts;
    let deposit_deadline_offset = ctx.accounts.pool.deposit_deadline_offset;
    let min_deposit_amount = ctx.accounts.pool.min_deposit_amount;
    let max_total_deposit = ctx.accounts.pool.max_total_deposit;
    let apr_bps = ctx.accounts.pool.apr_bps;
    let whitelist_enabled = ctx.accounts.pool.whitelist_enabled;
    let pool_key = ctx.accounts.pool.key();

    // Check deposit deadline
    if deposit_deadline_offset > 0 {
        let deadline = maturity_ts
            .checked_sub(deposit_deadline_offset as i64)
            .ok_or(VaultError::MathOverflow)?;
        require!(now <= deadline, VaultError::DepositDeadlinePassed);
    }

    // Check maturity not passed
    let time_to_maturity = maturity_ts
        .checked_sub(now)
        .ok_or(VaultError::MathOverflow)?;
    require!(time_to_maturity > 0, VaultError::DepositDeadlinePassed);

    require!(amount >= min_deposit_amount, VaultError::DepositTooSmall);

    // Check whitelist
    if whitelist_enabled {
        let permit = ctx.accounts.permit.as_mut()
            .ok_or(VaultError::NotWhitelisted)?;
        require!(permit.pool == pool_key, VaultError::NotWhitelisted);
        require!(permit.user == ctx.accounts.user.key(), VaultError::NotWhitelisted);
        if permit.expires_at > 0 {
            require!(now <= permit.expires_at, VaultError::PermitExpired);
        }
        if permit.max_amount > 0 {
            let new_used = permit.amount_used
                .checked_add(amount)
                .ok_or(VaultError::MathOverflow)?;
            require!(new_used <= permit.max_amount, VaultError::PermitLimitExceeded);
            permit.amount_used = new_used;
        }
    }

    // Calculate yield token mint amount
    let mint_amount = calc_expected_return(amount, apr_bps, time_to_maturity as u64)?;

    // Update pool totals
    let pool = &mut ctx.accounts.pool;
    pool.total_deposited = pool.total_deposited.checked_add(amount).ok_or(VaultError::MathOverflow)?;
    require!(pool.total_deposited <= max_total_deposit, VaultError::PoolCapExceeded);
    pool.total_expected_return = pool
        .total_expected_return
        .checked_add(mint_amount)
        .ok_or(VaultError::MathOverflow)?;

    // Transfer USDC: user → deposit_vault
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.deposit_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;

    // Mint yTokens: pool PDA → user
    let pool_id_bytes = pool_id.to_le_bytes();
    let seeds: &[&[u8]] = &[
        b"vault-pool",
        &pool_id_bytes,
        &[pool_bump],
    ];
    let signer_seeds = &[seeds];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.yield_mint.to_account_info(),
                to: ctx.accounts.user_yield_account.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            signer_seeds,
        ),
        mint_amount,
    )?;

    emit!(DepositEvent {
        pool: pool_key,
        user: ctx.accounts.user.key(),
        amount,
        y_tokens_minted: mint_amount,
        total_deposited: ctx.accounts.pool.total_deposited,
        ts: now,
    });

    Ok(())
}



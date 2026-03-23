use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::VaultError;
use crate::events::AdminWithdrawEvent;
use crate::state::{ProtocolConfig, VaultPool};

#[derive(Accounts)]
pub struct AdminWithdraw<'info> {
    #[account(
        mut,
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

    #[account(
        mut,
        address = pool.deposit_vault,
    )]
    pub deposit_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = admin_token_account.mint == pool.deposit_mint,
        constraint = admin_token_account.owner == authority.key(),
    )]
    pub admin_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_admin_withdraw(ctx: Context<AdminWithdraw>, amount: u64) -> Result<()> {
    let pool = &ctx.accounts.pool;

    // Limit: admin cannot withdraw more than total_deposited
    let already_withdrawn = pool.total_admin_withdrawn;
    let max_withdrawable = pool.total_deposited.checked_sub(already_withdrawn)
        .ok_or(VaultError::MathOverflow)?;
    require!(amount <= max_withdrawable, VaultError::AdminWithdrawExceeded);

    let pool_id_bytes = pool.pool_id.to_le_bytes();
    let seeds: &[&[u8]] = &[
        b"vault-pool",
        &pool_id_bytes,
        &[pool.bump],
    ];
    let signer_seeds = &[seeds];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.deposit_vault.to_account_info(),
                to: ctx.accounts.admin_token_account.to_account_info(),
                authority: pool.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    // Track amount withdrawn
    ctx.accounts.pool.total_admin_withdrawn = already_withdrawn
        .checked_add(amount)
        .ok_or(VaultError::MathOverflow)?;

    emit!(AdminWithdrawEvent {
        pool: ctx.accounts.pool.key(),
        authority: ctx.accounts.authority.key(),
        amount,
        total_admin_withdrawn: ctx.accounts.pool.total_admin_withdrawn,
        ts: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

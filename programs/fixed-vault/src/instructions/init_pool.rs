use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::errors::VaultError;
use crate::state::{ProtocolConfig, VaultPool};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitPoolParams {
    pub pool_id: u64,
    pub apy_bps: u16,
    pub maturity_ts: i64,
    pub deposit_deadline_offset: u64,
    pub min_deposit_amount: u64,
    pub max_total_deposit: u64,
    pub whitelist_enabled: bool,
}

#[derive(Accounts)]
#[instruction(params: InitPoolParams)]
pub struct InitPool<'info> {
    #[account(
        mut,
        constraint = authority.key() == config.authority @ VaultError::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(seeds = [b"protocol-config"], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        init,
        payer = authority,
        space = 8 + VaultPool::INIT_SPACE,
        seeds = [b"vault-pool" as &[u8], &params.pool_id.to_le_bytes()],
        bump
    )]
    pub pool: Account<'info, VaultPool>,

    pub deposit_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        token::mint = deposit_mint,
        token::authority = pool,
        seeds = [b"deposit-vault", pool.key().as_ref()],
        bump
    )]
    pub deposit_vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = authority,
        token::mint = deposit_mint,
        token::authority = pool,
        seeds = [b"repay-vault", pool.key().as_ref()],
        bump
    )]
    pub repay_vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = authority,
        mint::decimals = deposit_mint.decimals,
        mint::authority = pool,
        seeds = [b"yield-mint", pool.key().as_ref()],
        bump
    )]
    pub yield_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_init_pool(ctx: Context<InitPool>, params: InitPoolParams) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(params.maturity_ts > now, VaultError::InvalidMaturity);

    let pool = &mut ctx.accounts.pool;
    pool.pool_id = params.pool_id;
    pool.deposit_vault = ctx.accounts.deposit_vault.key();
    pool.repay_vault = ctx.accounts.repay_vault.key();
    pool.deposit_mint = ctx.accounts.deposit_mint.key();
    pool.yield_mint = ctx.accounts.yield_mint.key();
    pool.apy_bps = params.apy_bps;
    pool.maturity_ts = params.maturity_ts;
    pool.deposit_deadline_offset = params.deposit_deadline_offset;
    pool.min_deposit_amount = params.min_deposit_amount;
    pool.max_total_deposit = params.max_total_deposit;
    pool.total_deposited = 0;
    pool.total_expected_return = 0;
    pool.total_repaid = 0;
    pool.remaining_repay = 0;
    pool.total_admin_withdrawn = 0;
    pool.withdrawals_enabled = false;
    pool.whitelist_enabled = params.whitelist_enabled;
    pool.bump = ctx.bumps.pool;
    pool.deposit_vault_bump = ctx.bumps.deposit_vault;
    pool.repay_vault_bump = ctx.bumps.repay_vault;
    pool.yield_mint_bump = ctx.bumps.yield_mint;
    Ok(())
}

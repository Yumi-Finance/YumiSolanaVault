use anchor_lang::prelude::*;

use crate::errors::VaultError;
use crate::state::{ProtocolConfig, VaultPool};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdatePoolParams {
    pub max_total_deposit: Option<u64>,
    pub min_deposit_amount: Option<u64>,
    pub apy_bps: Option<u16>,
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
    if let Some(apy_bps) = params.apy_bps {
        pool.apy_bps = apy_bps;
    }

    Ok(())
}

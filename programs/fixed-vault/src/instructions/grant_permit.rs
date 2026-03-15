use anchor_lang::prelude::*;

use crate::errors::VaultError;
use crate::state::{DepositPermit, ProtocolConfig, VaultPool};

#[derive(Accounts)]
#[instruction(user: Pubkey)]
pub struct GrantPermit<'info> {
    #[account(
        mut,
        constraint = authority.key() == config.authority @ VaultError::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(seeds = [b"protocol-config"], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        seeds = [b"vault-pool" as &[u8], &pool.pool_id.to_le_bytes()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, VaultPool>,

    #[account(
        init,
        payer = authority,
        space = 8 + DepositPermit::INIT_SPACE,
        seeds = [b"permit", pool.key().as_ref(), user.as_ref()],
        bump
    )]
    pub permit: Account<'info, DepositPermit>,

    pub system_program: Program<'info, System>,
}

pub fn handle_grant_permit(
    ctx: Context<GrantPermit>,
    user: Pubkey,
    max_amount: u64,
    expires_at: i64,
) -> Result<()> {
    let permit = &mut ctx.accounts.permit;
    permit.pool = ctx.accounts.pool.key();
    permit.user = user;
    permit.max_amount = max_amount;
    permit.amount_used = 0;
    permit.expires_at = expires_at;
    permit.bump = ctx.bumps.permit;
    Ok(())
}

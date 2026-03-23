use anchor_lang::prelude::*;

use crate::errors::VaultError;
use crate::state::{DepositPermit, ProtocolConfig, VaultPool};

#[derive(Accounts)]
pub struct RevokePermit<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"protocol-config"],
        bump = config.bump,
        has_one = authority @ VaultError::Unauthorized,
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        seeds = [b"vault-pool" as &[u8], &pool.pool_id.to_le_bytes()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, VaultPool>,

    #[account(
        mut,
        close = authority,
        seeds = [b"permit", pool.key().as_ref(), permit.user.as_ref()],
        bump = permit.bump,
        has_one = pool,
    )]
    pub permit: Account<'info, DepositPermit>,
}

pub fn handle_revoke_permit(_ctx: Context<RevokePermit>) -> Result<()> {
    // Account is closed via `close = authority` constraint
    Ok(())
}

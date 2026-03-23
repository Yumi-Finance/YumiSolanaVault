use anchor_lang::prelude::*;

use crate::errors::VaultError;
use crate::state::ProtocolConfig;

// ---------- Step 1: Propose ----------

#[derive(Accounts)]
pub struct ProposeAuthority<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"protocol-config"],
        bump = config.bump,
        has_one = authority @ VaultError::Unauthorized,
    )]
    pub config: Account<'info, ProtocolConfig>,
}

pub fn handle_propose_authority(
    ctx: Context<ProposeAuthority>,
    new_authority: Pubkey,
) -> Result<()> {
    ctx.accounts.config.pending_authority = Some(new_authority);
    Ok(())
}

// ---------- Step 2: Accept ----------

#[derive(Accounts)]
pub struct AcceptAuthority<'info> {
    pub new_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"protocol-config"],
        bump = config.bump,
        constraint = config.pending_authority == Some(new_authority.key()) @ VaultError::NoPendingAuthority,
    )]
    pub config: Account<'info, ProtocolConfig>,
}

pub fn handle_accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.new_authority.key();
    config.pending_authority = None;
    Ok(())
}

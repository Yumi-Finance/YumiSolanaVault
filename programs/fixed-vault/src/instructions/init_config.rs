use anchor_lang::prelude::*;

use crate::errors::VaultError;
use crate::state::ProtocolConfig;
use crate::BOOTSTRAP_AUTHORITY;

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(
        mut,
        constraint = authority.key() == BOOTSTRAP_AUTHORITY @ VaultError::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + ProtocolConfig::INIT_SPACE,
        seeds = [b"protocol-config"],
        bump,
    )]
    pub config: Account<'info, ProtocolConfig>,

    pub system_program: Program<'info, System>,
}

pub fn handle_init_config(ctx: Context<InitConfig>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.pending_authority = None;
    config.bump = ctx.bumps.config;
    Ok(())
}

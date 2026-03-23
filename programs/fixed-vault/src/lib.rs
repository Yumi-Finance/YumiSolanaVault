use anchor_lang::prelude::*;

pub mod state;
pub mod errors;
pub mod events;
pub mod math;
pub mod instructions;

use instructions::*;

declare_id!("T4PVVqVnC8AxD9FbPEsPnwJkq957RfpwV41ZTLN8Xit");

pub const BOOTSTRAP_AUTHORITY: Pubkey = pubkey!("33Qc8SgCsHVoNgb75CKmSHkp63jiMTqJiZrBfznhcPwx");

/// Maximum allowed APR in basis points (4000 bps = 40%)
pub const MAX_APR_BPS: u16 = 4000;

#[program]
pub mod fixed_vault {
    use super::*;

    pub fn init_config(ctx: Context<InitConfig>) -> Result<()> {
        instructions::init_config::handle_init_config(ctx)
    }

    pub fn propose_authority(ctx: Context<ProposeAuthority>, new_authority: Pubkey) -> Result<()> {
        instructions::transfer_authority::handle_propose_authority(ctx, new_authority)
    }

    pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
        instructions::transfer_authority::handle_accept_authority(ctx)
    }

    pub fn init_pool(ctx: Context<InitPool>, params: InitPoolParams) -> Result<()> {
        instructions::init_pool::handle_init_pool(ctx, params)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::handle_deposit(ctx, amount)
    }

    pub fn admin_withdraw(ctx: Context<AdminWithdraw>, amount: u64) -> Result<()> {
        instructions::admin_withdraw::handle_admin_withdraw(ctx, amount)
    }

    pub fn repay(ctx: Context<Repay>, amount: u64) -> Result<()> {
        instructions::repay::handle_repay(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::withdraw::handle_withdraw(ctx, amount)
    }

    pub fn update_pool(ctx: Context<UpdatePool>, params: UpdatePoolParams) -> Result<()> {
        instructions::update_pool::handle_update_pool(ctx, params)
    }

    pub fn grant_permit(
        ctx: Context<GrantPermit>,
        user: Pubkey,
        max_amount: u64,
        expires_at: i64,
    ) -> Result<()> {
        instructions::grant_permit::handle_grant_permit(ctx, user, max_amount, expires_at)
    }

    pub fn revoke_permit(ctx: Context<RevokePermit>) -> Result<()> {
        instructions::revoke_permit::handle_revoke_permit(ctx)
    }

    pub fn enable_withdrawals(ctx: Context<EnableWithdrawals>) -> Result<()> {
        instructions::enable_withdrawals::handle_enable_withdrawals(ctx)
    }

    pub fn sweep_repay_vault(ctx: Context<SweepRepayVault>) -> Result<()> {
        instructions::sweep_repay_vault::handle_sweep_repay_vault(ctx)
    }
}

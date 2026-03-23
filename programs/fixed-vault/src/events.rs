use anchor_lang::prelude::*;

#[event]
pub struct DepositEvent {
    pub pool: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub y_tokens_minted: u64,
    pub total_deposited: u64,
    pub ts: i64,
}

#[event]
pub struct WithdrawEvent {
    pub pool: Pubkey,
    pub user: Pubkey,
    pub y_tokens_burned: u64,
    pub payout: u64,
    pub remaining_repay: u64,
    pub ts: i64,
}

#[event]
pub struct RepayEvent {
    pub pool: Pubkey,
    pub authority: Pubkey,
    pub amount: u64,
    pub total_repaid: u64,
    pub remaining_repay: u64,
    pub ts: i64,
}

#[event]
pub struct AdminWithdrawEvent {
    pub pool: Pubkey,
    pub authority: Pubkey,
    pub amount: u64,
    pub total_admin_withdrawn: u64,
    pub ts: i64,
}

#[event]
pub struct EnableWithdrawalsEvent {
    pub pool: Pubkey,
    pub authority: Pubkey,
    pub total_repaid: u64,
    pub total_expected_return: u64,
    pub ts: i64,
}

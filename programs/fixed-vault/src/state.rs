use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ProtocolConfig {
    /// Current protocol authority
    pub authority: Pubkey,
    /// Pending authority awaiting acceptance (two-step transfer)
    pub pending_authority: Option<Pubkey>,
    /// PDA bump
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct VaultPool {
    /// Pool identifier
    pub pool_id: u64,
    /// Token account PDA for user deposits
    pub deposit_vault: Pubkey,
    /// Token account PDA for admin repayments
    pub repay_vault: Pubkey,
    /// USDC mint address
    pub deposit_mint: Pubkey,
    /// Yield token mint PDA (1 yToken = 1 USDC at maturity)
    pub yield_mint: Pubkey,
    /// APY in basis points (e.g. 800 = 8%)
    pub apy_bps: u16,
    /// Unix timestamp when deposits mature and can be withdrawn
    pub maturity_ts: i64,
    /// Seconds before maturity_ts after which deposits are no longer accepted (0 = no restriction)
    pub deposit_deadline_offset: u64,
    /// Minimum deposit amount (e.g. 100_000_000 = 100 USDC)
    pub min_deposit_amount: u64,
    /// Maximum total active deposits (pool cap)
    pub max_total_deposit: u64,
    /// Current sum of deposited principal (never decreases)
    pub total_deposited: u64,
    /// Total outstanding yield token liability
    pub total_expected_return: u64,
    /// Total amount repaid by admin into repay_vault (historical, never decreases)
    pub total_repaid: u64,
    /// Remaining repay balance available for withdrawals (decreases on withdraw)
    pub remaining_repay: u64,
    /// Total amount withdrawn by admin from deposit_vault
    pub total_admin_withdrawn: u64,
    /// Whether withdrawals are enabled (set by admin after repay)
    pub withdrawals_enabled: bool,
    /// Whether deposits require a DepositPermit
    pub whitelist_enabled: bool,
    /// PDA bump
    pub bump: u8,
    /// Deposit vault PDA bump
    pub deposit_vault_bump: u8,
    /// Repay vault PDA bump
    pub repay_vault_bump: u8,
    /// Yield mint PDA bump
    pub yield_mint_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct DepositPermit {
    /// Pool this permit belongs to
    pub pool: Pubkey,
    /// User allowed to deposit
    pub user: Pubkey,
    /// Max cumulative deposit amount (0 = unlimited)
    pub max_amount: u64,
    /// Amount already deposited under this permit
    pub amount_used: u64,
    /// Permit expiry unix timestamp (0 = no expiry)
    pub expires_at: i64,
    /// PDA bump
    pub bump: u8,
}

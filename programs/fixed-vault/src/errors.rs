use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
    #[msg("Deposit amount is below the minimum")]
    DepositTooSmall,
    #[msg("Deposit would exceed the pool cap")]
    PoolCapExceeded,
    #[msg("Maturity date has not been reached yet")]
    MaturityNotReached,
    #[msg("Deposit deadline has passed")]
    DepositDeadlinePassed,
    #[msg("New cap cannot be below current total active deposits")]
    CapBelowActive,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Deposit requires a valid whitelist permit")]
    NotWhitelisted,
    #[msg("Deposit permit has expired")]
    PermitExpired,
    #[msg("Withdrawals are not enabled yet")]
    WithdrawalsNotEnabled,
    #[msg("Cannot repay after withdrawals have been enabled")]
    RepayAfterWithdrawalsEnabled,
    #[msg("Only the protocol authority can perform this action")]
    Unauthorized,
    #[msg("Admin withdraw would exceed total active deposits")]
    AdminWithdrawExceeded,
    #[msg("Cannot enable withdrawals with no repay funds")]
    NoRepayToDistribute,
    #[msg("No pending authority to accept")]
    NoPendingAuthority,
    #[msg("Cumulative deposit would exceed permit limit")]
    PermitLimitExceeded,
    #[msg("Maturity timestamp must be in the future")]
    InvalidMaturity,
    #[msg("Deposit mint decimals must be <= 9")]
    DecimalsTooHigh,
    #[msg("Deposit deadline offset must be less than pool duration")]
    InvalidDeadlineOffset,
    #[msg("Withdrawal amount must be greater than zero")]
    WithdrawalTooSmall,
    #[msg("Repay amount would exceed total expected return")]
    RepayExceedsCap,
    #[msg("allow_overpay flag cannot be revoked once enabled")]
    CannotRevokeOverpay,
    #[msg("Sweep grace period (180 days post-maturity) has not elapsed")]
    SweepGracePeriodNotElapsed,
    #[msg("Repay vault is empty, nothing to sweep")]
    NothingToSweep,
    #[msg("No repay funds remaining for withdrawal")]
    NoRepayRemaining,
    #[msg("APY exceeds maximum allowed basis points (4000 bps = 40%)")]
    ApyTooHigh,
}

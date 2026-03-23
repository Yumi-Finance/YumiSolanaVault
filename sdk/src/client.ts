import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  TransactionInstruction,
  TransactionSignature,
  Transaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { FixedVault } from "./idl";
import idlJson from "./fixed_vault.json";
import {
  findConfigPda,
  findPoolPda,
  findDepositVaultPda,
  findRepayVaultPda,
  findYieldMintPda,
  findPermitPda,
} from "./pda";
import { normalizeProgramId, ProgramIdInput } from "./programId";
import {
  InitPoolParams,
  UpdatePoolParams,
  VaultPoolAccount,
  ProtocolConfigAccount,
  DepositPermitAccount,
  PoolAddresses,
} from "./types";

export class VaultClient {
  readonly program: Program<FixedVault>;
  readonly provider: AnchorProvider;

  constructor(provider: AnchorProvider, opts?: { programId?: ProgramIdInput }) {
    this.provider = provider;
    const programId = normalizeProgramId(opts?.programId);
    const runtimeIdl = { ...(idlJson as any), address: programId.toBase58() };
    this.program = new Program<FixedVault>(runtimeIdl, provider);
  }

  // ---------------------------------------------------------------------------
  // PDA helpers
  // ---------------------------------------------------------------------------

  deriveConfigAddress(): PublicKey {
    const [config] = findConfigPda(this.program.programId);
    return config;
  }

  derivePoolAddresses(poolId: BN | number): PoolAddresses {
    const [pool, poolBump] = findPoolPda(poolId, this.program.programId);
    const [depositVault, depositVaultBump] = findDepositVaultPda(pool, this.program.programId);
    const [repayVault, repayVaultBump] = findRepayVaultPda(pool, this.program.programId);
    const [yieldMint, yieldMintBump] = findYieldMintPda(pool, this.program.programId);
    return { pool, poolBump, depositVault, depositVaultBump, repayVault, repayVaultBump, yieldMint, yieldMintBump };
  }

  derivePermitAddress(pool: PublicKey, user: PublicKey): PublicKey {
    const [permit] = findPermitPda(pool, user, this.program.programId);
    return permit;
  }

  // ---------------------------------------------------------------------------
  // Account fetchers
  // ---------------------------------------------------------------------------

  async fetchConfig(config?: PublicKey): Promise<ProtocolConfigAccount> {
    const addr = config ?? this.deriveConfigAddress();
    return (await this.program.account.protocolConfig.fetch(addr)) as unknown as ProtocolConfigAccount;
  }

  async fetchConfigOrNull(config?: PublicKey): Promise<ProtocolConfigAccount | null> {
    const addr = config ?? this.deriveConfigAddress();
    return (await this.program.account.protocolConfig.fetchNullable(addr)) as unknown as ProtocolConfigAccount | null;
  }

  async fetchPool(pool: PublicKey): Promise<VaultPoolAccount> {
    return (await this.program.account.vaultPool.fetch(pool)) as unknown as VaultPoolAccount;
  }

  async fetchPoolOrNull(pool: PublicKey): Promise<VaultPoolAccount | null> {
    return (await this.program.account.vaultPool.fetchNullable(pool)) as unknown as VaultPoolAccount | null;
  }

  async fetchPermit(permit: PublicKey): Promise<DepositPermitAccount> {
    return (await this.program.account.depositPermit.fetch(permit)) as unknown as DepositPermitAccount;
  }

  async fetchPermitOrNull(permit: PublicKey): Promise<DepositPermitAccount | null> {
    return (await this.program.account.depositPermit.fetchNullable(permit)) as unknown as DepositPermitAccount | null;
  }

  // ---------------------------------------------------------------------------
  // Instruction builders (return TransactionInstruction)
  // ---------------------------------------------------------------------------

  async initConfigIx(
    authority: PublicKey
  ): Promise<TransactionInstruction> {
    const config = this.deriveConfigAddress();
    return this.program.methods
      .initConfig()
      .accountsPartial({
        authority,
        config,
      })
      .instruction();
  }

  async proposeAuthorityIx(
    authority: PublicKey,
    newAuthority: PublicKey
  ): Promise<TransactionInstruction> {
    const config = this.deriveConfigAddress();
    return this.program.methods
      .proposeAuthority(newAuthority)
      .accountsPartial({
        authority,
        config,
      })
      .instruction();
  }

  async acceptAuthorityIx(
    newAuthority: PublicKey
  ): Promise<TransactionInstruction> {
    const config = this.deriveConfigAddress();
    return this.program.methods
      .acceptAuthority()
      .accountsPartial({
        newAuthority,
        config,
      })
      .instruction();
  }

  async initPoolIx(
    authority: PublicKey,
    depositMint: PublicKey,
    params: InitPoolParams
  ): Promise<TransactionInstruction> {
    const addrs = this.derivePoolAddresses(params.poolId);
    const config = this.deriveConfigAddress();
    return this.program.methods
      .initPool(params)
      .accountsPartial({
        authority,
        config,
        pool: addrs.pool,
        depositMint,
        depositVault: addrs.depositVault,
        repayVault: addrs.repayVault,
        yieldMint: addrs.yieldMint,
      })
      .instruction();
  }

  /**
   * Returns instructions for deposit. Automatically derives ATAs and
   * prepends createAssociatedTokenAccountIdempotent for the user's deposit-token ATA
   * (e.g. USDC) and yield ATA if they don't exist. Returns an array — send ALL in one transaction.
   */
  async depositIxs(
    user: PublicKey,
    pool: PublicKey,
    amount: BN,
    permit: PublicKey | null = null
  ): Promise<TransactionInstruction[]> {
    const poolData = await this.fetchPool(pool);
    const userTokenAccount = getAssociatedTokenAddressSync(poolData.depositMint, user);
    const userYieldAccount = getAssociatedTokenAddressSync(poolData.yieldMint, user);

    const createTokenAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      user, userTokenAccount, user, poolData.depositMint
    );
    const createYieldAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      user, userYieldAccount, user, poolData.yieldMint
    );

    const depositIx = await this.program.methods
      .deposit(amount)
      .accountsPartial({
        user,
        pool,
        userTokenAccount,
        depositVault: poolData.depositVault,
        yieldMint: poolData.yieldMint,
        userYieldAccount,
        permit,
      })
      .instruction();

    return [createTokenAtaIx, createYieldAtaIx, depositIx];
  }

  /** @deprecated Use depositIxs() instead — it auto-creates the yield ATA */
  async depositIx(
    user: PublicKey,
    pool: PublicKey,
    amount: BN,
    userTokenAccount: PublicKey,
    userYieldAccount: PublicKey,
    permit: PublicKey | null = null
  ): Promise<TransactionInstruction> {
    const poolData = await this.fetchPool(pool);
    return this.program.methods
      .deposit(amount)
      .accountsPartial({
        user,
        pool,
        userTokenAccount,
        depositVault: poolData.depositVault,
        yieldMint: poolData.yieldMint,
        userYieldAccount,
        permit,
      })
      .instruction();
  }

  async adminWithdrawIx(
    authority: PublicKey,
    pool: PublicKey,
    amount: BN,
    adminTokenAccount: PublicKey
  ): Promise<TransactionInstruction> {
    const poolData = await this.fetchPool(pool);
    const config = this.deriveConfigAddress();
    return this.program.methods
      .adminWithdraw(amount)
      .accountsPartial({
        authority,
        config,
        pool,
        depositVault: poolData.depositVault,
        adminTokenAccount,
      })
      .instruction();
  }

  async repayIx(
    authority: PublicKey,
    pool: PublicKey,
    amount: BN,
    adminTokenAccount: PublicKey
  ): Promise<TransactionInstruction> {
    const poolData = await this.fetchPool(pool);
    const config = this.deriveConfigAddress();
    return this.program.methods
      .repay(amount)
      .accountsPartial({
        authority,
        config,
        pool,
        adminTokenAccount,
        repayVault: poolData.repayVault,
      })
      .instruction();
  }

  /**
   * Returns instructions for withdraw. Automatically derives ATAs and
   * prepends a createAssociatedTokenAccountIdempotent for the deposit token ATA
   * (in case user closed it). Returns an array — send ALL in one transaction.
   */
  async withdrawIxs(
    user: PublicKey,
    pool: PublicKey,
    amount: BN
  ): Promise<TransactionInstruction[]> {
    const poolData = await this.fetchPool(pool);
    const userTokenAccount = getAssociatedTokenAddressSync(poolData.depositMint, user);
    const userYieldAccount = getAssociatedTokenAddressSync(poolData.yieldMint, user);

    const createTokenAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      user, userTokenAccount, user, poolData.depositMint
    );

    const withdrawIx = await this.program.methods
      .withdraw(amount)
      .accountsPartial({
        user,
        pool,
        yieldMint: poolData.yieldMint,
        userYieldAccount,
        repayVault: poolData.repayVault,
        userTokenAccount,
      })
      .instruction();

    return [createTokenAtaIx, withdrawIx];
  }

  /** @deprecated Use withdrawIxs() instead — it auto-creates ATAs */
  async withdrawIx(
    user: PublicKey,
    pool: PublicKey,
    amount: BN,
    userYieldAccount: PublicKey,
    userTokenAccount: PublicKey
  ): Promise<TransactionInstruction> {
    const poolData = await this.fetchPool(pool);
    return this.program.methods
      .withdraw(amount)
      .accountsPartial({
        user,
        pool,
        yieldMint: poolData.yieldMint,
        userYieldAccount,
        repayVault: poolData.repayVault,
        userTokenAccount,
      })
      .instruction();
  }

  async updatePoolIx(
    authority: PublicKey,
    pool: PublicKey,
    params: UpdatePoolParams
  ): Promise<TransactionInstruction> {
    const config = this.deriveConfigAddress();
    return this.program.methods
      .updatePool(params)
      .accountsPartial({
        authority,
        config,
        pool,
      })
      .instruction();
  }

  async grantPermitIx(
    authority: PublicKey,
    pool: PublicKey,
    user: PublicKey,
    maxAmount: BN,
    expiresAt: BN
  ): Promise<TransactionInstruction> {
    const permit = this.derivePermitAddress(pool, user);
    const config = this.deriveConfigAddress();
    return this.program.methods
      .grantPermit(user, maxAmount, expiresAt)
      .accountsPartial({
        authority,
        config,
        pool,
        permit,
      })
      .instruction();
  }

  async revokePermitIx(
    authority: PublicKey,
    pool: PublicKey,
    permit: PublicKey
  ): Promise<TransactionInstruction> {
    const config = this.deriveConfigAddress();
    return this.program.methods
      .revokePermit()
      .accountsPartial({
        authority,
        config,
        pool,
        permit,
      })
      .instruction();
  }

  async enableWithdrawalsIx(
    authority: PublicKey,
    pool: PublicKey
  ): Promise<TransactionInstruction> {
    const config = this.deriveConfigAddress();
    return this.program.methods
      .enableWithdrawals()
      .accountsPartial({
        authority,
        config,
        pool,
      })
      .instruction();
  }

  // ---------------------------------------------------------------------------
  // Convenience rpc() wrappers (sign + send via provider)
  // ---------------------------------------------------------------------------

  private async sendTx(
    ixs: TransactionInstruction | TransactionInstruction[],
    signers: Keypair[] = []
  ): Promise<TransactionSignature> {
    const tx = new Transaction();
    if (Array.isArray(ixs)) {
      tx.add(...ixs);
    } else {
      tx.add(ixs);
    }
    return this.provider.sendAndConfirm(tx, signers);
  }

  async initConfig(): Promise<TransactionSignature> {
    const authority = this.provider.wallet.publicKey;
    const ix = await this.initConfigIx(authority);
    return this.sendTx(ix);
  }

  async proposeAuthority(newAuthority: PublicKey): Promise<TransactionSignature> {
    const authority = this.provider.wallet.publicKey;
    const ix = await this.proposeAuthorityIx(authority, newAuthority);
    return this.sendTx(ix);
  }

  async acceptAuthority(): Promise<TransactionSignature> {
    const newAuthority = this.provider.wallet.publicKey;
    const ix = await this.acceptAuthorityIx(newAuthority);
    return this.sendTx(ix);
  }

  async initPool(
    depositMint: PublicKey,
    params: InitPoolParams
  ): Promise<TransactionSignature> {
    const authority = this.provider.wallet.publicKey;
    const ix = await this.initPoolIx(authority, depositMint, params);
    return this.sendTx(ix);
  }

  async deposit(
    pool: PublicKey,
    amount: BN,
    permit: PublicKey | null = null,
    user?: Keypair
  ): Promise<TransactionSignature> {
    const userPubkey = user?.publicKey ?? this.provider.wallet.publicKey;
    const ixs = await this.depositIxs(userPubkey, pool, amount, permit);
    return this.sendTx(ixs, user ? [user] : []);
  }

  async adminWithdraw(
    pool: PublicKey,
    amount: BN,
    adminTokenAccount: PublicKey
  ): Promise<TransactionSignature> {
    const authority = this.provider.wallet.publicKey;
    const ix = await this.adminWithdrawIx(authority, pool, amount, adminTokenAccount);
    return this.sendTx(ix);
  }

  async repay(
    pool: PublicKey,
    amount: BN,
    adminTokenAccount: PublicKey
  ): Promise<TransactionSignature> {
    const authority = this.provider.wallet.publicKey;
    const ix = await this.repayIx(authority, pool, amount, adminTokenAccount);
    return this.sendTx(ix);
  }

  async withdraw(
    pool: PublicKey,
    amount: BN,
    user?: Keypair
  ): Promise<TransactionSignature> {
    const userPubkey = user?.publicKey ?? this.provider.wallet.publicKey;
    const ixs = await this.withdrawIxs(userPubkey, pool, amount);
    return this.sendTx(ixs, user ? [user] : []);
  }

  async updatePool(pool: PublicKey, params: UpdatePoolParams): Promise<TransactionSignature> {
    const authority = this.provider.wallet.publicKey;
    const ix = await this.updatePoolIx(authority, pool, params);
    return this.sendTx(ix);
  }

  async grantPermit(
    pool: PublicKey,
    user: PublicKey,
    maxAmount: BN,
    expiresAt: BN
  ): Promise<TransactionSignature> {
    const authority = this.provider.wallet.publicKey;
    const ix = await this.grantPermitIx(authority, pool, user, maxAmount, expiresAt);
    return this.sendTx(ix);
  }

  async revokePermit(pool: PublicKey, permit: PublicKey): Promise<TransactionSignature> {
    const authority = this.provider.wallet.publicKey;
    const ix = await this.revokePermitIx(authority, pool, permit);
    return this.sendTx(ix);
  }

  async enableWithdrawals(pool: PublicKey): Promise<TransactionSignature> {
    const authority = this.provider.wallet.publicKey;
    const ix = await this.enableWithdrawalsIx(authority, pool);
    return this.sendTx(ix);
  }

  // ---------------------------------------------------------------------------
  // Multi-account fetchers
  // ---------------------------------------------------------------------------

  async fetchAllPools(): Promise<{ pubkey: PublicKey; account: VaultPoolAccount }[]> {
    const raw = await this.program.account.vaultPool.all();
    return raw.map((r) => ({
      pubkey: r.publicKey,
      account: r.account as unknown as VaultPoolAccount,
    }));
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  static calcExpectedReturn(amount: BN, apyBps: number, maturityTs: BN, nowTs: BN): BN {
    const timeToMaturity = maturityTs.sub(nowTs);
    if (timeToMaturity.lten(0)) return amount;
    const SECONDS_PER_YEAR = new BN(365 * 24 * 3600);
    const BPS_BASE = new BN(10_000);
    const interest = amount.mul(new BN(apyBps)).mul(timeToMaturity).div(BPS_BASE.mul(SECONDS_PER_YEAR));
    return amount.add(interest);
  }

  static isMatured(maturityTs: BN, nowTs?: BN): boolean {
    const now = nowTs ?? new BN(Math.floor(Date.now() / 1000));
    return now.gte(maturityTs);
  }

  static isDepositOpen(maturityTs: BN, depositDeadlineOffset: BN, nowTs?: BN): boolean {
    const now = nowTs ?? new BN(Math.floor(Date.now() / 1000));
    if (depositDeadlineOffset.eqn(0)) return now.lt(maturityTs);
    const deadline = maturityTs.sub(depositDeadlineOffset);
    return now.lte(deadline);
  }
}

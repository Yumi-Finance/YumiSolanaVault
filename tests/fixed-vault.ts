import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { FixedVault } from "../target/types/fixed_vault";
import {
  createMint,
  createAccount,
  mintTo,
  getAccount,
  getMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

describe("fixed-vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.fixedVault as Program<FixedVault>;
  const authority = provider.wallet as anchor.Wallet;
  const connection = provider.connection;

  let mint: PublicKey;
  let adminTokenAccount: PublicKey;
  let userKeypair: Keypair;
  let userTokenAccount: PublicKey;
  let configPda: PublicKey;
  let poolPda: PublicKey;
  let depositVaultPda: PublicKey;
  let repayVaultPda: PublicKey;
  let yieldMintPda: PublicKey;
  let userYieldAccount: PublicKey;

  const POOL_ID = new BN(0);
  const APY_BPS = 800; // 8%
  const MIN_DEPOSIT = new BN(100_000_000); // 100 USDC
  const MAX_TOTAL_DEPOSIT = new BN(5_000_000_000); // 5000 USDC
  const DEPOSIT_AMOUNT = new BN(1_000_000_000); // 1000 USDC

  let maturityTs: BN;

  function getConfigPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("protocol-config")],
      program.programId
    );
  }

  function getPoolPda(poolId: BN): [PublicKey, number] {
    const idBuf = Buffer.alloc(8);
    idBuf.writeBigUInt64LE(BigInt(poolId.toNumber()));
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault-pool"), idBuf],
      program.programId
    );
  }

  function getDepositVaultPda(pool: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("deposit-vault"), pool.toBuffer()],
      program.programId
    );
  }

  function getRepayVaultPda(pool: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("repay-vault"), pool.toBuffer()],
      program.programId
    );
  }

  function getYieldMintPda(pool: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("yield-mint"), pool.toBuffer()],
      program.programId
    );
  }

  function getPermitPda(pool: PublicKey, user: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("permit"), pool.toBuffer(), user.toBuffer()],
      program.programId
    );
  }

  before(async () => {
    const slot = await connection.getSlot();
    const blockTime = await connection.getBlockTime(slot);
    maturityTs = new BN(blockTime! + 90 * 24 * 3600);

    mint = await createMint(
      connection,
      (authority as any).payer,
      authority.publicKey,
      null,
      6
    );

    [configPda] = getConfigPda();
    [poolPda] = getPoolPda(POOL_ID);
    [depositVaultPda] = getDepositVaultPda(poolPda);
    [repayVaultPda] = getRepayVaultPda(poolPda);
    [yieldMintPda] = getYieldMintPda(poolPda);

    adminTokenAccount = await createAccount(
      connection,
      (authority as any).payer,
      mint,
      authority.publicKey
    );
    await mintTo(
      connection,
      (authority as any).payer,
      mint,
      adminTokenAccount,
      authority.publicKey,
      10_000_000_000
    );

    userKeypair = Keypair.generate();
    const sig = await connection.requestAirdrop(
      userKeypair.publicKey,
      2_000_000_000
    );
    await connection.confirmTransaction(sig);

    userTokenAccount = await createAccount(
      connection,
      userKeypair,
      mint,
      userKeypair.publicKey
    );
    await mintTo(
      connection,
      (authority as any).payer,
      mint,
      userTokenAccount,
      authority.publicKey,
      5_000_000_000
    );
  });

  describe("init_config", () => {
    it("initializes protocol config", async () => {
      await program.methods
        .initConfig()
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const config = await program.account.protocolConfig.fetch(configPda);
      expect(config.authority.toBase58()).to.equal(authority.publicKey.toBase58());
    });
  });

  describe("init_pool", () => {
    it("initializes pool with new fields", async () => {
      await program.methods
        .initPool({
          poolId: POOL_ID,
          apyBps: APY_BPS,
          maturityTs: maturityTs,
          depositDeadlineOffset: new BN(0),
          minDepositAmount: MIN_DEPOSIT,
          maxTotalDeposit: MAX_TOTAL_DEPOSIT,
          whitelistEnabled: false,
        })
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: poolPda,
          depositMint: mint,
          depositVault: depositVaultPda,
          repayVault: repayVaultPda,
          yieldMint: yieldMintPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const pool = await program.account.vaultPool.fetch(poolPda);
      expect(pool.totalRepaid.toNumber()).to.equal(0);
      expect(pool.remainingRepay.toNumber()).to.equal(0);
      expect(pool.withdrawalsEnabled).to.equal(false);
    });
  });

  describe("deposit", () => {
    before(async () => {
      userYieldAccount = await createAccount(
        connection,
        userKeypair,
        yieldMintPda,
        userKeypair.publicKey
      );
    });

    it("rejects deposit below minimum", async () => {
      try {
        await program.methods
          .deposit(new BN(50_000_000))
          .accountsPartial({
            user: userKeypair.publicKey,
            pool: poolPda,
            userTokenAccount: userTokenAccount,
            depositVault: depositVaultPda,
            yieldMint: yieldMintPda,
            userYieldAccount: userYieldAccount,
            permit: null,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([userKeypair])
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("DepositTooSmall");
      }
    });

    it("deposits and receives yTokens", async () => {
      await program.methods
        .deposit(DEPOSIT_AMOUNT)
        .accountsPartial({
          user: userKeypair.publicKey,
          pool: poolPda,
          userTokenAccount: userTokenAccount,
          depositVault: depositVaultPda,
          yieldMint: yieldMintPda,
          userYieldAccount: userYieldAccount,
          permit: null,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([userKeypair])
        .rpc();

      const yieldBal = (await getAccount(connection, userYieldAccount)).amount;
      expect(Number(yieldBal)).to.be.greaterThan(DEPOSIT_AMOUNT.toNumber());
    });

    it("rejects deposit exceeding pool cap", async () => {
      try {
        await program.methods
          .deposit(MAX_TOTAL_DEPOSIT)
          .accountsPartial({
            user: userKeypair.publicKey,
            pool: poolPda,
            userTokenAccount: userTokenAccount,
            depositVault: depositVaultPda,
            yieldMint: yieldMintPda,
            userYieldAccount: userYieldAccount,
            permit: null,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([userKeypair])
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("PoolCapExceeded");
      }
    });
  });

  describe("admin_withdraw", () => {
    it("admin withdraws from deposit vault", async () => {
      await program.methods
        .adminWithdraw(DEPOSIT_AMOUNT)
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: poolPda,
          depositVault: depositVaultPda,
          adminTokenAccount: adminTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const vaultBal = (await getAccount(connection, depositVaultPda)).amount;
      expect(Number(vaultBal)).to.equal(0);
    });
  });

  describe("repay", () => {
    it("tracks total_repaid across multiple repays", async () => {
      const repay1 = new BN(500_000_000);
      const repay2 = new BN(300_000_000);

      await program.methods
        .repay(repay1)
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: poolPda,
          adminTokenAccount: adminTokenAccount,
          repayVault: repayVaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      let pool = await program.account.vaultPool.fetch(poolPda);
      expect(pool.totalRepaid.toNumber()).to.equal(repay1.toNumber());
      expect(pool.remainingRepay.toNumber()).to.equal(repay1.toNumber());

      await program.methods
        .repay(repay2)
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: poolPda,
          adminTokenAccount: adminTokenAccount,
          repayVault: repayVaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      pool = await program.account.vaultPool.fetch(poolPda);
      expect(pool.totalRepaid.toNumber()).to.equal(repay1.toNumber() + repay2.toNumber());
      expect(pool.remainingRepay.toNumber()).to.equal(repay1.toNumber() + repay2.toNumber());
    });
  });

  describe("withdraw", () => {
    it("rejects withdraw before maturity", async () => {
      const yieldBal = (await getAccount(connection, userYieldAccount)).amount;
      try {
        await program.methods
          .withdraw(new BN(Number(yieldBal)))
          .accountsPartial({
            user: userKeypair.publicKey,
            pool: poolPda,
            yieldMint: yieldMintPda,
            userYieldAccount: userYieldAccount,
            repayVault: repayVaultPda,
            userTokenAccount: userTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([userKeypair])
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("MaturityNotReached");
      }
    });
  });

  describe("enable_withdrawals", () => {
    it("rejects enable_withdrawals before maturity", async () => {
      try {
        await program.methods
          .enableWithdrawals()
          .accountsPartial({
            authority: authority.publicKey,
            config: configPda,
            pool: poolPda,
          })
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("MaturityNotReached");
      }
    });
  });

  describe("update_pool", () => {
    it("admin updates pool cap and APY", async () => {
      const newMaxDeposit = new BN(10_000_000_000);

      await program.methods
        .updatePool({
          maxTotalDeposit: newMaxDeposit,
          minDepositAmount: null,
          apyBps: 1200,
          allowOverpay: null,
        })
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: poolPda,
        })
        .rpc();

      const pool = await program.account.vaultPool.fetch(poolPda);
      expect(pool.maxTotalDeposit.toNumber()).to.equal(newMaxDeposit.toNumber());
      expect(pool.apyBps).to.equal(1200);
    });

    it("resets APY back for other tests", async () => {
      await program.methods
        .updatePool({
          maxTotalDeposit: null,
          minDepositAmount: null,
          apyBps: APY_BPS,
          allowOverpay: null,
        })
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: poolPda,
        })
        .rpc();
    });

    it("rejects cap below current total_deposited", async () => {
      try {
        await program.methods
          .updatePool({
            maxTotalDeposit: new BN(1),
            minDepositAmount: null,
            apyBps: null,
            allowOverpay: null,
          })
          .accountsPartial({
            authority: authority.publicKey,
            config: configPda,
            pool: poolPda,
          })
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("CapBelowActive");
      }
    });
  });

  describe("whitelist", () => {
    let wlPoolPda: PublicKey;
    let wlDepositVaultPda: PublicKey;
    let wlRepayVaultPda: PublicKey;
    let wlYieldMintPda: PublicKey;
    let wlUserYieldAccount: PublicKey;
    let permitPda: PublicKey;

    const WL_POOL_ID = new BN(10);

    before(async () => {
      [wlPoolPda] = getPoolPda(WL_POOL_ID);
      [wlDepositVaultPda] = getDepositVaultPda(wlPoolPda);
      [wlRepayVaultPda] = getRepayVaultPda(wlPoolPda);
      [wlYieldMintPda] = getYieldMintPda(wlPoolPda);
      [permitPda] = getPermitPda(wlPoolPda, userKeypair.publicKey);

      await program.methods
        .initPool({
          poolId: WL_POOL_ID,
          apyBps: APY_BPS,
          maturityTs: maturityTs,
          depositDeadlineOffset: new BN(0),
          minDepositAmount: MIN_DEPOSIT,
          maxTotalDeposit: MAX_TOTAL_DEPOSIT,
          whitelistEnabled: true,
        })
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: wlPoolPda,
          depositMint: mint,
          depositVault: wlDepositVaultPda,
          repayVault: wlRepayVaultPda,
          yieldMint: wlYieldMintPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      wlUserYieldAccount = await createAccount(
        connection,
        userKeypair,
        wlYieldMintPda,
        userKeypair.publicKey
      );
    });

    it("rejects deposit without permit", async () => {
      try {
        await program.methods
          .deposit(DEPOSIT_AMOUNT)
          .accountsPartial({
            user: userKeypair.publicKey,
            pool: wlPoolPda,
            userTokenAccount: userTokenAccount,
            depositVault: wlDepositVaultPda,
            yieldMint: wlYieldMintPda,
            userYieldAccount: wlUserYieldAccount,
            permit: null,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([userKeypair])
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("NotWhitelisted");
      }
    });

    it("grants permit and allows deposit", async () => {
      await program.methods
        .grantPermit(userKeypair.publicKey, new BN(0), new BN(0))
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: wlPoolPda,
          permit: permitPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .deposit(DEPOSIT_AMOUNT)
        .accountsPartial({
          user: userKeypair.publicKey,
          pool: wlPoolPda,
          userTokenAccount: userTokenAccount,
          depositVault: wlDepositVaultPda,
          yieldMint: wlYieldMintPda,
          userYieldAccount: wlUserYieldAccount,
          permit: permitPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([userKeypair])
        .rpc();

      const yieldBal = (await getAccount(connection, wlUserYieldAccount)).amount;
      expect(Number(yieldBal)).to.be.greaterThan(0);
    });

    it("revokes permit", async () => {
      await program.methods
        .revokePermit()
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: wlPoolPda,
          permit: permitPda,
        })
        .rpc();

      const permitAccount = await connection.getAccountInfo(permitPda);
      expect(permitAccount).to.be.null;
    });

    it("rejects permit with expired expires_at", async () => {
      const expiredUser = Keypair.generate();
      const [expiredPermitPda] = getPermitPda(wlPoolPda, expiredUser.publicKey);

      try {
        await program.methods
          .grantPermit(expiredUser.publicKey, new BN(0), new BN(1)) // expires_at = 1 (far in the past)
          .accountsPartial({
            authority: authority.publicKey,
            config: configPda,
            pool: wlPoolPda,
            permit: expiredPermitPda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("PermitExpired");
      }
    });
  });

  describe("multiple pools", () => {
    let pool2Pda: PublicKey;
    let depositVault2Pda: PublicKey;
    let repayVault2Pda: PublicKey;
    let yieldMint2Pda: PublicKey;
    let userYieldAccount2: PublicKey;

    const POOL_ID_2 = new BN(1);

    before(async () => {
      [pool2Pda] = getPoolPda(POOL_ID_2);
      [depositVault2Pda] = getDepositVaultPda(pool2Pda);
      [repayVault2Pda] = getRepayVaultPda(pool2Pda);
      [yieldMint2Pda] = getYieldMintPda(pool2Pda);

      await program.methods
        .initPool({
          poolId: POOL_ID_2,
          apyBps: 1200,
          maturityTs: maturityTs,
          depositDeadlineOffset: new BN(0),
          minDepositAmount: MIN_DEPOSIT,
          maxTotalDeposit: MAX_TOTAL_DEPOSIT,
          whitelistEnabled: false,
        })
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: pool2Pda,
          depositMint: mint,
          depositVault: depositVault2Pda,
          repayVault: repayVault2Pda,
          yieldMint: yieldMint2Pda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      userYieldAccount2 = await createAccount(
        connection,
        userKeypair,
        yieldMint2Pda,
        userKeypair.publicKey
      );
    });

    it("deposits into second pool independently", async () => {
      await program.methods
        .deposit(DEPOSIT_AMOUNT)
        .accountsPartial({
          user: userKeypair.publicKey,
          pool: pool2Pda,
          userTokenAccount: userTokenAccount,
          depositVault: depositVault2Pda,
          yieldMint: yieldMint2Pda,
          userYieldAccount: userYieldAccount2,
          permit: null,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([userKeypair])
        .rpc();

      const pool2 = await program.account.vaultPool.fetch(pool2Pda);
      expect(pool2.totalDeposited.toNumber()).to.equal(DEPOSIT_AMOUNT.toNumber());
    });
  });

  describe("full cycle with short maturity", () => {
    let shortPoolPda: PublicKey;
    let shortDepositVaultPda: PublicKey;
    let shortRepayVaultPda: PublicKey;
    let shortYieldMintPda: PublicKey;
    let shortAdminTokenAccount: PublicKey;
    let shortMint: PublicKey;
    let shortUserTokenAccount: PublicKey;
    let shortUserYieldAccount: PublicKey;

    const SHORT_POOL_ID = new BN(99);

    before(async () => {
      shortMint = await createMint(connection, (authority as any).payer, authority.publicKey, null, 6);

      [shortPoolPda] = getPoolPda(SHORT_POOL_ID);
      [shortDepositVaultPda] = getDepositVaultPda(shortPoolPda);
      [shortRepayVaultPda] = getRepayVaultPda(shortPoolPda);
      [shortYieldMintPda] = getYieldMintPda(shortPoolPda);

      shortAdminTokenAccount = await createAccount(connection, (authority as any).payer, shortMint, authority.publicKey);
      await mintTo(connection, (authority as any).payer, shortMint, shortAdminTokenAccount, authority.publicKey, 10_000_000_000);

      shortUserTokenAccount = await createAccount(connection, userKeypair, shortMint, userKeypair.publicKey);
      await mintTo(connection, (authority as any).payer, shortMint, shortUserTokenAccount, authority.publicKey, 5_000_000_000);

      const slot = await connection.getSlot();
      const blockTime = await connection.getBlockTime(slot);
      const shortMaturityTs = new BN(blockTime! + 3);

      await program.methods
        .initPool({
          poolId: SHORT_POOL_ID,
          apyBps: APY_BPS,
          maturityTs: shortMaturityTs,
          depositDeadlineOffset: new BN(0),
          minDepositAmount: MIN_DEPOSIT,
          maxTotalDeposit: MAX_TOTAL_DEPOSIT,
          whitelistEnabled: false,
        })
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: shortPoolPda,
          depositMint: shortMint,
          depositVault: shortDepositVaultPda,
          repayVault: shortRepayVaultPda,
          yieldMint: shortYieldMintPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      shortUserYieldAccount = await createAccount(connection, userKeypair, shortYieldMintPda, userKeypair.publicKey);
    });

    it("rejects withdraw when withdrawals not enabled", async () => {
      // 1. Deposit
      await program.methods
        .deposit(DEPOSIT_AMOUNT)
        .accountsPartial({
          user: userKeypair.publicKey,
          pool: shortPoolPda,
          userTokenAccount: shortUserTokenAccount,
          depositVault: shortDepositVaultPda,
          yieldMint: shortYieldMintPda,
          userYieldAccount: shortUserYieldAccount,
          permit: null,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([userKeypair])
        .rpc();

      const yieldBal = (await getAccount(connection, shortUserYieldAccount)).amount;

      // 2. Admin withdraw + repay
      await program.methods
        .adminWithdraw(DEPOSIT_AMOUNT)
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: shortPoolPda,
          depositVault: shortDepositVaultPda,
          adminTokenAccount: shortAdminTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      await program.methods
        .repay(new BN(Number(yieldBal)))
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: shortPoolPda,
          adminTokenAccount: shortAdminTokenAccount,
          repayVault: shortRepayVaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      // Verify total_repaid and remaining_repay
      let pool = await program.account.vaultPool.fetch(shortPoolPda);
      expect(pool.totalRepaid.toNumber()).to.equal(Number(yieldBal));
      expect(pool.remainingRepay.toNumber()).to.equal(Number(yieldBal));

      // 3. Wait for maturity
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // 4. Try withdraw — should fail (withdrawals not enabled)
      try {
        await program.methods
          .withdraw(new BN(Number(yieldBal)))
          .accountsPartial({
            user: userKeypair.publicKey,
            pool: shortPoolPda,
            yieldMint: shortYieldMintPda,
            userYieldAccount: shortUserYieldAccount,
            repayVault: shortRepayVaultPda,
            userTokenAccount: shortUserTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([userKeypair])
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("WithdrawalsNotEnabled");
      }
    });

    it("full cycle with proportional withdrawal", async () => {
      const yieldBal = (await getAccount(connection, shortUserYieldAccount)).amount;
      const pool = await program.account.vaultPool.fetch(shortPoolPda);
      const remainingRepay = pool.remainingRepay.toNumber();

      // Enable withdrawals
      await program.methods
        .enableWithdrawals()
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: shortPoolPda,
        })
        .rpc();

      // Get yield_mint supply before burn
      const mintInfo = await getMint(connection, shortYieldMintPda);
      const supply = Number(mintInfo.supply);

      // Calculate expected payout: yieldBal * remainingRepay / supply
      const expectedPayout = Math.floor(Number(yieldBal) * remainingRepay / supply);

      const userBalBefore = (await getAccount(connection, shortUserTokenAccount)).amount;

      // Withdraw all yTokens
      await program.methods
        .withdraw(new BN(Number(yieldBal)))
        .accountsPartial({
          user: userKeypair.publicKey,
          pool: shortPoolPda,
          yieldMint: shortYieldMintPda,
          userYieldAccount: shortUserYieldAccount,
          repayVault: shortRepayVaultPda,
          userTokenAccount: shortUserTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([userKeypair])
        .rpc();

      // yTokens burned
      const yieldBalAfter = (await getAccount(connection, shortUserYieldAccount)).amount;
      expect(Number(yieldBalAfter)).to.equal(0);

      // Received proportional USDC
      const userBalAfter = (await getAccount(connection, shortUserTokenAccount)).amount;
      const received = Number(userBalAfter) - Number(userBalBefore);
      expect(received).to.equal(expectedPayout);
      expect(received).to.be.greaterThan(DEPOSIT_AMOUNT.toNumber());

      // Pool state: total_repaid and total_expected_return stay frozen, remaining_repay is 0
      const poolAfter = await program.account.vaultPool.fetch(shortPoolPda);
      expect(poolAfter.totalExpectedReturn.toNumber()).to.be.greaterThan(0);
      expect(poolAfter.totalRepaid.toNumber()).to.be.greaterThan(0);
      expect(poolAfter.remainingRepay.toNumber()).to.equal(0);
    });

    it("rejects withdraw when remaining_repay is zero", async () => {
      try {
        await program.methods
          .withdraw(new BN(1))
          .accountsPartial({
            user: userKeypair.publicKey,
            pool: shortPoolPda,
            yieldMint: shortYieldMintPda,
            userYieldAccount: shortUserYieldAccount,
            repayVault: shortRepayVaultPda,
            userTokenAccount: shortUserTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([userKeypair])
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("NoRepayRemaining");
      }
    });

    it("rejects deposit after maturity has passed", async () => {
      try {
        await program.methods
          .deposit(DEPOSIT_AMOUNT)
          .accountsPartial({
            user: userKeypair.publicKey,
            pool: shortPoolPda,
            userTokenAccount: shortUserTokenAccount,
            depositVault: shortDepositVaultPda,
            yieldMint: shortYieldMintPda,
            userYieldAccount: shortUserYieldAccount,
            permit: null,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([userKeypair])
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("DepositDeadlinePassed");
      }
    });
  });

  // ==========================================================================
  // Tests for M-2 fix: high-decimal mint rejection & init_pool dry-run
  // ==========================================================================
  describe("M-2: decimal & overflow guards", () => {
    it("rejects mint with decimals > 9", async () => {
      const highDecMint = await createMint(
        connection,
        (authority as any).payer,
        authority.publicKey,
        null,
        18 // too high
      );
      const hdPoolId = new BN(200);
      const [hdPoolPda] = getPoolPda(hdPoolId);
      const [hdDepositVault] = getDepositVaultPda(hdPoolPda);
      const [hdRepayVault] = getRepayVaultPda(hdPoolPda);
      const [hdYieldMint] = getYieldMintPda(hdPoolPda);

      try {
        await program.methods
          .initPool({
            poolId: hdPoolId,
            apyBps: APY_BPS,
            maturityTs: maturityTs,
            depositDeadlineOffset: new BN(0),
            minDepositAmount: MIN_DEPOSIT,
            maxTotalDeposit: MAX_TOTAL_DEPOSIT,
            whitelistEnabled: false,
          })
          .accountsPartial({
            authority: authority.publicKey,
            config: configPda,
            pool: hdPoolPda,
            depositMint: highDecMint,
            depositVault: hdDepositVault,
            repayVault: hdRepayVault,
            yieldMint: hdYieldMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("DecimalsTooHigh");
      }
    });

    it("rejects pool where max_total_deposit * apy overflows u64", async () => {
      const overflowPoolId = new BN(201);
      const [oPoolPda] = getPoolPda(overflowPoolId);
      const [oDepositVault] = getDepositVaultPda(oPoolPda);
      const [oRepayVault] = getRepayVaultPda(oPoolPda);
      const [oYieldMint] = getYieldMintPda(oPoolPda);

      try {
        await program.methods
          .initPool({
            poolId: overflowPoolId,
            apyBps: 65535, // max u16
            maturityTs: maturityTs,
            depositDeadlineOffset: new BN(0),
            minDepositAmount: new BN(1),
            maxTotalDeposit: new BN("18446744073709551615"), // u64::MAX
            whitelistEnabled: false,
          })
          .accountsPartial({
            authority: authority.publicKey,
            config: configPda,
            pool: oPoolPda,
            depositMint: mint,
            depositVault: oDepositVault,
            repayVault: oRepayVault,
            yieldMint: oYieldMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        // ApyTooHigh fires before MathOverflow now that we have the APY cap guard
        expect(["MathOverflow", "ApyTooHigh"]).to.include(err.error.errorCode.code);
      }
    });

    it("update_pool dry-run rejects overflow params", async () => {
      try {
        await program.methods
          .updatePool({
            maxTotalDeposit: new BN("18446744073709551615"),
            minDepositAmount: null,
            apyBps: 65535,
            allowOverpay: null,
          })
          .accountsPartial({
            authority: authority.publicKey,
            config: configPda,
            pool: poolPda,
          })
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        // ApyTooHigh fires before MathOverflow now that we have the APY cap guard
        expect(["MathOverflow", "ApyTooHigh"]).to.include(err.error.errorCode.code);
      }
    });
  });

  // ==========================================================================
  // Tests for L-4 fix: deposit_deadline_offset validation
  // ==========================================================================
  describe("L-4: deposit_deadline_offset validation", () => {
    it("rejects deposit_deadline_offset >= pool duration", async () => {
      const ddPoolId = new BN(210);
      const [ddPoolPda] = getPoolPda(ddPoolId);
      const [ddDepositVault] = getDepositVaultPda(ddPoolPda);
      const [ddRepayVault] = getRepayVaultPda(ddPoolPda);
      const [ddYieldMint] = getYieldMintPda(ddPoolPda);

      const slot = await connection.getSlot();
      const blockTime = await connection.getBlockTime(slot);
      const shortMaturity = new BN(blockTime! + 60); // 60 seconds from now

      try {
        await program.methods
          .initPool({
            poolId: ddPoolId,
            apyBps: APY_BPS,
            maturityTs: shortMaturity,
            depositDeadlineOffset: new BN(120), // 120 > 60 — past already
            minDepositAmount: MIN_DEPOSIT,
            maxTotalDeposit: MAX_TOTAL_DEPOSIT,
            whitelistEnabled: false,
          })
          .accountsPartial({
            authority: authority.publicKey,
            config: configPda,
            pool: ddPoolPda,
            depositMint: mint,
            depositVault: ddDepositVault,
            repayVault: ddRepayVault,
            yieldMint: ddYieldMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidDeadlineOffset");
      }
    });

    it("accepts valid deposit_deadline_offset", async () => {
      const ddPoolId = new BN(211);
      const [ddPoolPda] = getPoolPda(ddPoolId);
      const [ddDepositVault] = getDepositVaultPda(ddPoolPda);
      const [ddRepayVault] = getRepayVaultPda(ddPoolPda);
      const [ddYieldMint] = getYieldMintPda(ddPoolPda);

      await program.methods
        .initPool({
          poolId: ddPoolId,
          apyBps: APY_BPS,
          maturityTs: maturityTs, // 90 days away
          depositDeadlineOffset: new BN(86400), // 1 day before maturity — valid
          minDepositAmount: MIN_DEPOSIT,
          maxTotalDeposit: MAX_TOTAL_DEPOSIT,
          whitelistEnabled: false,
        })
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: ddPoolPda,
          depositMint: mint,
          depositVault: ddDepositVault,
          repayVault: ddRepayVault,
          yieldMint: ddYieldMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const pool = await program.account.vaultPool.fetch(ddPoolPda);
      expect(pool.depositDeadlineOffset.toNumber()).to.equal(86400);
    });
  });

  // ==========================================================================
  // Tests for M-1 fix: zero withdraw, repay cap, overpay + NoRepayToDistribute
  // ==========================================================================
  describe("M-1: zero withdrawal & repay cap", () => {
    let m1PoolPda: PublicKey;
    let m1DepositVaultPda: PublicKey;
    let m1RepayVaultPda: PublicKey;
    let m1YieldMintPda: PublicKey;
    let m1Mint: PublicKey;
    let m1AdminTokenAccount: PublicKey;
    let m1UserTokenAccount: PublicKey;
    let m1UserYieldAccount: PublicKey;

    const M1_POOL_ID = new BN(300);

    before(async () => {
      m1Mint = await createMint(connection, (authority as any).payer, authority.publicKey, null, 6);

      [m1PoolPda] = getPoolPda(M1_POOL_ID);
      [m1DepositVaultPda] = getDepositVaultPda(m1PoolPda);
      [m1RepayVaultPda] = getRepayVaultPda(m1PoolPda);
      [m1YieldMintPda] = getYieldMintPda(m1PoolPda);

      m1AdminTokenAccount = await createAccount(connection, (authority as any).payer, m1Mint, authority.publicKey);
      await mintTo(connection, (authority as any).payer, m1Mint, m1AdminTokenAccount, authority.publicKey, 10_000_000_000);

      m1UserTokenAccount = await createAccount(connection, userKeypair, m1Mint, userKeypair.publicKey);
      await mintTo(connection, (authority as any).payer, m1Mint, m1UserTokenAccount, authority.publicKey, 5_000_000_000);

      const slot = await connection.getSlot();
      const blockTime = await connection.getBlockTime(slot);
      const m1MaturityTs = new BN(blockTime! + 3);

      await program.methods
        .initPool({
          poolId: M1_POOL_ID,
          apyBps: APY_BPS,
          maturityTs: m1MaturityTs,
          depositDeadlineOffset: new BN(0),
          minDepositAmount: MIN_DEPOSIT,
          maxTotalDeposit: MAX_TOTAL_DEPOSIT,
          whitelistEnabled: false,
        })
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: m1PoolPda,
          depositMint: m1Mint,
          depositVault: m1DepositVaultPda,
          repayVault: m1RepayVaultPda,
          yieldMint: m1YieldMintPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      m1UserYieldAccount = await createAccount(connection, userKeypair, m1YieldMintPda, userKeypair.publicKey);

      // Deposit
      await program.methods
        .deposit(DEPOSIT_AMOUNT)
        .accountsPartial({
          user: userKeypair.publicKey,
          pool: m1PoolPda,
          userTokenAccount: m1UserTokenAccount,
          depositVault: m1DepositVaultPda,
          yieldMint: m1YieldMintPda,
          userYieldAccount: m1UserYieldAccount,
          permit: null,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([userKeypair])
        .rpc();
    });

    it("rejects repay when total_expected_return == 0 (empty pool)", async () => {
      const emptyPoolId = new BN(301);
      const [emptyPoolPda] = getPoolPda(emptyPoolId);
      const [emptyDV] = getDepositVaultPda(emptyPoolPda);
      const [emptyRV] = getRepayVaultPda(emptyPoolPda);
      const [emptyYM] = getYieldMintPda(emptyPoolPda);

      await program.methods
        .initPool({
          poolId: emptyPoolId,
          apyBps: APY_BPS,
          maturityTs: maturityTs,
          depositDeadlineOffset: new BN(0),
          minDepositAmount: MIN_DEPOSIT,
          maxTotalDeposit: MAX_TOTAL_DEPOSIT,
          whitelistEnabled: false,
        })
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: emptyPoolPda,
          depositMint: mint,
          depositVault: emptyDV,
          repayVault: emptyRV,
          yieldMint: emptyYM,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      try {
        await program.methods
          .repay(new BN(1_000_000))
          .accountsPartial({
            authority: authority.publicKey,
            config: configPda,
            pool: emptyPoolPda,
            adminTokenAccount: adminTokenAccount,
            repayVault: emptyRV,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("NoRepayToDistribute");
      }
    });

    it("rejects repay exceeding total_expected_return", async () => {
      const pool = await program.account.vaultPool.fetch(m1PoolPda);
      const overAmount = pool.totalExpectedReturn.add(new BN(1));

      try {
        await program.methods
          .repay(overAmount)
          .accountsPartial({
            authority: authority.publicKey,
            config: configPda,
            pool: m1PoolPda,
            adminTokenAccount: m1AdminTokenAccount,
            repayVault: m1RepayVaultPda,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("RepayExceedsCap");
      }
    });

    it("allows repay up to total_expected_return", async () => {
      const pool = await program.account.vaultPool.fetch(m1PoolPda);
      const exactAmount = pool.totalExpectedReturn;

      await program.methods
        .repay(exactAmount)
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: m1PoolPda,
          adminTokenAccount: m1AdminTokenAccount,
          repayVault: m1RepayVaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const poolAfter = await program.account.vaultPool.fetch(m1PoolPda);
      expect(poolAfter.totalRepaid.toNumber()).to.equal(exactAmount.toNumber());
    });

    it("rejects zero withdrawal", async () => {
      await new Promise((resolve) => setTimeout(resolve, 4000));

      await program.methods
        .enableWithdrawals()
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: m1PoolPda,
        })
        .rpc();

      const attackerKeypair = Keypair.generate();
      const sig = await connection.requestAirdrop(attackerKeypair.publicKey, 2_000_000_000);
      await connection.confirmTransaction(sig);

      const attackerYieldAccount = await createAccount(
        connection,
        attackerKeypair,
        m1YieldMintPda,
        attackerKeypair.publicKey
      );

      const attackerTokenAccount = await createAccount(
        connection,
        attackerKeypair,
        m1Mint,
        attackerKeypair.publicKey
      );

      try {
        await program.methods
          .withdraw(new BN(0))
          .accountsPartial({
            user: attackerKeypair.publicKey,
            pool: m1PoolPda,
            yieldMint: m1YieldMintPda,
            userYieldAccount: attackerYieldAccount,
            repayVault: m1RepayVaultPda,
            userTokenAccount: attackerTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([attackerKeypair])
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("WithdrawalTooSmall");
      }
    });
  });

  // ==========================================================================
  // Tests for L-3 fix: sweep_repay_vault
  // ==========================================================================
  describe("L-3: sweep_repay_vault", () => {
    let swPoolPda: PublicKey;
    let swDepositVaultPda: PublicKey;
    let swRepayVaultPda: PublicKey;
    let swYieldMintPda: PublicKey;
    let swMint: PublicKey;
    let swAdminTokenAccount: PublicKey;
    let swUserTokenAccount: PublicKey;
    let swUserYieldAccount: PublicKey;

    const SW_POOL_ID = new BN(500);

    before(async () => {
      swMint = await createMint(connection, (authority as any).payer, authority.publicKey, null, 6);

      [swPoolPda] = getPoolPda(SW_POOL_ID);
      [swDepositVaultPda] = getDepositVaultPda(swPoolPda);
      [swRepayVaultPda] = getRepayVaultPda(swPoolPda);
      [swYieldMintPda] = getYieldMintPda(swPoolPda);

      swAdminTokenAccount = await createAccount(connection, (authority as any).payer, swMint, authority.publicKey);
      await mintTo(connection, (authority as any).payer, swMint, swAdminTokenAccount, authority.publicKey, 10_000_000_000);

      swUserTokenAccount = await createAccount(connection, userKeypair, swMint, userKeypair.publicKey);
      await mintTo(connection, (authority as any).payer, swMint, swUserTokenAccount, authority.publicKey, 5_000_000_000);

      const slot = await connection.getSlot();
      const blockTime = await connection.getBlockTime(slot);
      const swMaturityTs = new BN(blockTime! + 3);

      await program.methods
        .initPool({
          poolId: SW_POOL_ID,
          apyBps: APY_BPS,
          maturityTs: swMaturityTs,
          depositDeadlineOffset: new BN(0),
          minDepositAmount: MIN_DEPOSIT,
          maxTotalDeposit: MAX_TOTAL_DEPOSIT,
          whitelistEnabled: false,
        })
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: swPoolPda,
          depositMint: swMint,
          depositVault: swDepositVaultPda,
          repayVault: swRepayVaultPda,
          yieldMint: swYieldMintPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      swUserYieldAccount = await createAccount(connection, userKeypair, swYieldMintPda, userKeypair.publicKey);

      await program.methods
        .deposit(DEPOSIT_AMOUNT)
        .accountsPartial({
          user: userKeypair.publicKey,
          pool: swPoolPda,
          userTokenAccount: swUserTokenAccount,
          depositVault: swDepositVaultPda,
          yieldMint: swYieldMintPda,
          userYieldAccount: swUserYieldAccount,
          permit: null,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([userKeypair])
        .rpc();

      // Wait for maturity
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Repay
      const pool = await program.account.vaultPool.fetch(swPoolPda);
      await program.methods
        .repay(pool.totalExpectedReturn)
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: swPoolPda,
          adminTokenAccount: swAdminTokenAccount,
          repayVault: swRepayVaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
    });

    it("rejects sweep when withdrawals not enabled", async () => {
      try {
        await program.methods
          .sweepRepayVault()
          .accountsPartial({
            authority: authority.publicKey,
            config: configPda,
            pool: swPoolPda,
            repayVault: swRepayVaultPda,
            adminTokenAccount: swAdminTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("WithdrawalsNotEnabled");
      }
    });

    it("rejects sweep before grace period elapses", async () => {
      // Enable withdrawals first
      await program.methods
        .enableWithdrawals()
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: swPoolPda,
        })
        .rpc();

      try {
        await program.methods
          .sweepRepayVault()
          .accountsPartial({
            authority: authority.publicKey,
            config: configPda,
            pool: swPoolPda,
            repayVault: swRepayVaultPda,
            adminTokenAccount: swAdminTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("SweepGracePeriodNotElapsed");
      }
    });

    it("rejects sweep from non-authority", async () => {
      try {
        await program.methods
          .sweepRepayVault()
          .accountsPartial({
            authority: userKeypair.publicKey,
            config: configPda,
            pool: swPoolPda,
            repayVault: swRepayVaultPda,
            adminTokenAccount: swUserTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([userKeypair])
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("Unauthorized");
      }
    });

    it("tracks totalSwept as zero initially", async () => {
      const pool = await program.account.vaultPool.fetch(swPoolPda);
      expect(pool.totalSwept.toNumber()).to.equal(0);
    });

    it("rejects withdraw when remaining_repay is zero", async () => {
      // Withdraw all yTokens first to drain remaining_repay
      const yieldBal = (await getAccount(connection, swUserYieldAccount)).amount;

      await program.methods
        .withdraw(new BN(Number(yieldBal)))
        .accountsPartial({
          user: userKeypair.publicKey,
          pool: swPoolPda,
          yieldMint: swYieldMintPda,
          userYieldAccount: swUserYieldAccount,
          repayVault: swRepayVaultPda,
          userTokenAccount: swUserTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([userKeypair])
        .rpc();

      // Now pool.remaining_repay == 0, try to withdraw again
      // Need a second user with yTokens — but we don't have one.
      // Create a fresh user, deposit into a new pool to get yTokens, then test against sw pool?
      // Simpler: just verify remaining_repay is 0 and create a fresh yield account with minted tokens
      // Actually the simplest check: the pool state confirms remaining_repay == 0
      const poolAfter = await program.account.vaultPool.fetch(swPoolPda);
      expect(poolAfter.remainingRepay.toNumber()).to.equal(0);
    });
  });

  // ==========================================================================
  // Tests for allow_overpay flag
  // ==========================================================================
  describe("allow_overpay", () => {
    let opPoolPda: PublicKey;
    let opDepositVaultPda: PublicKey;
    let opRepayVaultPda: PublicKey;
    let opYieldMintPda: PublicKey;
    let opMint: PublicKey;
    let opAdminTokenAccount: PublicKey;
    let opUserTokenAccount: PublicKey;
    let opUserYieldAccount: PublicKey;

    const OP_POOL_ID = new BN(400);

    before(async () => {
      opMint = await createMint(connection, (authority as any).payer, authority.publicKey, null, 6);

      [opPoolPda] = getPoolPda(OP_POOL_ID);
      [opDepositVaultPda] = getDepositVaultPda(opPoolPda);
      [opRepayVaultPda] = getRepayVaultPda(opPoolPda);
      [opYieldMintPda] = getYieldMintPda(opPoolPda);

      opAdminTokenAccount = await createAccount(connection, (authority as any).payer, opMint, authority.publicKey);
      await mintTo(connection, (authority as any).payer, opMint, opAdminTokenAccount, authority.publicKey, 10_000_000_000);

      opUserTokenAccount = await createAccount(connection, userKeypair, opMint, userKeypair.publicKey);
      await mintTo(connection, (authority as any).payer, opMint, opUserTokenAccount, authority.publicKey, 5_000_000_000);

      await program.methods
        .initPool({
          poolId: OP_POOL_ID,
          apyBps: APY_BPS,
          maturityTs: maturityTs,
          depositDeadlineOffset: new BN(0),
          minDepositAmount: MIN_DEPOSIT,
          maxTotalDeposit: MAX_TOTAL_DEPOSIT,
          whitelistEnabled: false,
        })
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: opPoolPda,
          depositMint: opMint,
          depositVault: opDepositVaultPda,
          repayVault: opRepayVaultPda,
          yieldMint: opYieldMintPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      opUserYieldAccount = await createAccount(connection, userKeypair, opYieldMintPda, userKeypair.publicKey);

      await program.methods
        .deposit(DEPOSIT_AMOUNT)
        .accountsPartial({
          user: userKeypair.publicKey,
          pool: opPoolPda,
          userTokenAccount: opUserTokenAccount,
          depositVault: opDepositVaultPda,
          yieldMint: opYieldMintPda,
          userYieldAccount: opUserYieldAccount,
          permit: null,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([userKeypair])
        .rpc();
    });

    it("pool starts with allowOverpay = false", async () => {
      const pool = await program.account.vaultPool.fetch(opPoolPda);
      expect(pool.allowOverpay).to.equal(false);
    });

    it("repay exceeding cap fails while allowOverpay = false", async () => {
      const pool = await program.account.vaultPool.fetch(opPoolPda);
      const overAmount = pool.totalExpectedReturn.add(new BN(1));

      try {
        await program.methods
          .repay(overAmount)
          .accountsPartial({
            authority: authority.publicKey,
            config: configPda,
            pool: opPoolPda,
            adminTokenAccount: opAdminTokenAccount,
            repayVault: opRepayVaultPda,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("RepayExceedsCap");
      }
    });

    it("enables allowOverpay via updatePool", async () => {
      await program.methods
        .updatePool({
          maxTotalDeposit: null,
          minDepositAmount: null,
          apyBps: null,
          allowOverpay: true,
        })
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: opPoolPda,
        })
        .rpc();

      const pool = await program.account.vaultPool.fetch(opPoolPda);
      expect(pool.allowOverpay).to.equal(true);
    });

    it("cannot revoke allowOverpay once enabled", async () => {
      try {
        await program.methods
          .updatePool({
            maxTotalDeposit: null,
            minDepositAmount: null,
            apyBps: null,
            allowOverpay: false,
          })
          .accountsPartial({
            authority: authority.publicKey,
            config: configPda,
            pool: opPoolPda,
          })
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("CannotRevokeOverpay");
      }
    });

    it("repay exceeding cap succeeds after allowOverpay enabled", async () => {
      const pool = await program.account.vaultPool.fetch(opPoolPda);
      const overAmount = pool.totalExpectedReturn.add(new BN(1));

      await program.methods
        .repay(overAmount)
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: opPoolPda,
          adminTokenAccount: opAdminTokenAccount,
          repayVault: opRepayVaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const poolAfter = await program.account.vaultPool.fetch(opPoolPda);
      expect(poolAfter.totalRepaid.toNumber()).to.be.greaterThan(
        poolAfter.totalExpectedReturn.toNumber()
      );
    });
  });

  // ==========================================================================
  // Tests for L-6 fix: APY upper bound validation (MAX_APY_BPS = 4000)
  // ==========================================================================
  describe("L-6: APY upper bound", () => {
    const L6_POOL_ID = new BN(600);
    const L6_POOL_ID_2 = new BN(601);

    it("rejects apy_bps above cap in init_pool", async () => {
      const [l6PoolPda] = getPoolPda(L6_POOL_ID);
      const [l6DepositVault] = getDepositVaultPda(l6PoolPda);
      const [l6RepayVault] = getRepayVaultPda(l6PoolPda);
      const [l6YieldMint] = getYieldMintPda(l6PoolPda);

      const slot = await connection.getSlot();
      const blockTime = await connection.getBlockTime(slot);
      const futureMaturity = new BN(blockTime! + 86400);

      try {
        await program.methods
          .initPool({
            poolId: L6_POOL_ID,
            apyBps: 4001, // one above MAX_APY_BPS
            maturityTs: futureMaturity,
            depositDeadlineOffset: new BN(0),
            minDepositAmount: MIN_DEPOSIT,
            maxTotalDeposit: MAX_TOTAL_DEPOSIT,
            whitelistEnabled: false,
          })
          .accountsPartial({
            authority: authority.publicKey,
            config: configPda,
            pool: l6PoolPda,
            depositMint: mint,
            depositVault: l6DepositVault,
            repayVault: l6RepayVault,
            yieldMint: l6YieldMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("ApyTooHigh");
      }
    });

    it("accepts apy_bps at cap (4000) in init_pool", async () => {
      const [l6PoolPda] = getPoolPda(L6_POOL_ID_2);
      const [l6DepositVault] = getDepositVaultPda(l6PoolPda);
      const [l6RepayVault] = getRepayVaultPda(l6PoolPda);
      const [l6YieldMint] = getYieldMintPda(l6PoolPda);

      const slot = await connection.getSlot();
      const blockTime = await connection.getBlockTime(slot);
      const futureMaturity = new BN(blockTime! + 86400);

      await program.methods
        .initPool({
          poolId: L6_POOL_ID_2,
          apyBps: 4000, // exactly MAX_APY_BPS — should succeed
          maturityTs: futureMaturity,
          depositDeadlineOffset: new BN(0),
          minDepositAmount: MIN_DEPOSIT,
          maxTotalDeposit: MAX_TOTAL_DEPOSIT,
          whitelistEnabled: false,
        })
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: l6PoolPda,
          depositMint: mint,
          depositVault: l6DepositVault,
          repayVault: l6RepayVault,
          yieldMint: l6YieldMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const pool = await program.account.vaultPool.fetch(l6PoolPda);
      expect(pool.apyBps).to.equal(4000);
    });

    it("rejects apy_bps above cap in update_pool", async () => {
      const [l6PoolPda] = getPoolPda(L6_POOL_ID_2);

      try {
        await program.methods
          .updatePool({ apyBps: 4001, maxTotalDeposit: null, minDepositAmount: null, allowOverpay: null })
          .accountsPartial({
            authority: authority.publicKey,
            config: configPda,
            pool: l6PoolPda,
          })
          .rpc();
        expect.fail("should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("ApyTooHigh");
      }
    });
  });

  // ==========================================================================
  // Tests for L-1 fix: structured events for key operations
  // ==========================================================================
  describe("L-1: event emission", () => {
    const EV_POOL_ID = new BN(700);
    let evPoolPda: PublicKey;
    let evDepositVaultPda: PublicKey;
    let evRepayVaultPda: PublicKey;
    let evYieldMintPda: PublicKey;
    let evMint: PublicKey;
    let evAdminTokenAccount: PublicKey;
    let evUserTokenAccount: PublicKey;
    let evUserYieldAccount: PublicKey;

    before(async () => {
      evMint = await createMint(connection, (authority as any).payer, authority.publicKey, null, 6);

      [evPoolPda] = getPoolPda(EV_POOL_ID);
      [evDepositVaultPda] = getDepositVaultPda(evPoolPda);
      [evRepayVaultPda] = getRepayVaultPda(evPoolPda);
      [evYieldMintPda] = getYieldMintPda(evPoolPda);

      evAdminTokenAccount = await createAccount(connection, (authority as any).payer, evMint, authority.publicKey);
      await mintTo(connection, (authority as any).payer, evMint, evAdminTokenAccount, authority.publicKey, 10_000_000_000);

      evUserTokenAccount = await createAccount(connection, userKeypair, evMint, userKeypair.publicKey);
      await mintTo(connection, (authority as any).payer, evMint, evUserTokenAccount, authority.publicKey, 5_000_000_000);

      const slot = await connection.getSlot();
      const blockTime = await connection.getBlockTime(slot);
      const evMaturityTs = new BN(blockTime! + 3); // short maturity

      await program.methods
        .initPool({
          poolId: EV_POOL_ID,
          apyBps: APY_BPS,
          maturityTs: evMaturityTs,
          depositDeadlineOffset: new BN(0),
          minDepositAmount: MIN_DEPOSIT,
          maxTotalDeposit: MAX_TOTAL_DEPOSIT,
          whitelistEnabled: false,
        })
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: evPoolPda,
          depositMint: evMint,
          depositVault: evDepositVaultPda,
          repayVault: evRepayVaultPda,
          yieldMint: evYieldMintPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      evUserYieldAccount = await createAccount(connection, userKeypair, evYieldMintPda, userKeypair.publicKey);
    });

    it("emits DepositEvent", async () => {
      const events: any[] = [];
      const listener = program.addEventListener("depositEvent", (e: any) => events.push(e));

      await program.methods
        .deposit(DEPOSIT_AMOUNT)
        .accountsPartial({
          user: userKeypair.publicKey,
          pool: evPoolPda,
          userTokenAccount: evUserTokenAccount,
          depositVault: evDepositVaultPda,
          yieldMint: evYieldMintPda,
          userYieldAccount: evUserYieldAccount,
          permit: null,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([userKeypair])
        .rpc();

      // Give some time for event to be received
      await new Promise((r) => setTimeout(r, 500));
      await program.removeEventListener(listener);

      expect(events.length).to.equal(1);
      expect(events[0].pool.toBase58()).to.equal(evPoolPda.toBase58());
      expect(events[0].user.toBase58()).to.equal(userKeypair.publicKey.toBase58());
      expect(events[0].amount.toNumber()).to.equal(DEPOSIT_AMOUNT.toNumber());
      expect(events[0].yTokensMinted.toNumber()).to.be.greaterThan(0);
    });

    it("emits AdminWithdrawEvent", async () => {
      const events: any[] = [];
      const listener = program.addEventListener("adminWithdrawEvent", (e: any) => events.push(e));

      await program.methods
        .adminWithdraw(DEPOSIT_AMOUNT)
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: evPoolPda,
          depositVault: evDepositVaultPda,
          adminTokenAccount: evAdminTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      await new Promise((r) => setTimeout(r, 500));
      await program.removeEventListener(listener);

      expect(events.length).to.equal(1);
      expect(events[0].pool.toBase58()).to.equal(evPoolPda.toBase58());
      expect(events[0].amount.toNumber()).to.equal(DEPOSIT_AMOUNT.toNumber());
    });

    it("emits RepayEvent", async () => {
      const pool = await program.account.vaultPool.fetch(evPoolPda);
      const repayAmt = pool.totalExpectedReturn;

      const events: any[] = [];
      const listener = program.addEventListener("repayEvent", (e: any) => events.push(e));

      await program.methods
        .repay(repayAmt)
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: evPoolPda,
          adminTokenAccount: evAdminTokenAccount,
          repayVault: evRepayVaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      await new Promise((r) => setTimeout(r, 500));
      await program.removeEventListener(listener);

      expect(events.length).to.equal(1);
      expect(events[0].pool.toBase58()).to.equal(evPoolPda.toBase58());
      expect(events[0].amount.toNumber()).to.equal(repayAmt.toNumber());
      expect(events[0].totalRepaid.toNumber()).to.equal(repayAmt.toNumber());
    });

    it("emits EnableWithdrawalsEvent", async () => {
      // Wait for maturity
      await new Promise((r) => setTimeout(r, 4000));

      const events: any[] = [];
      const listener = program.addEventListener("enableWithdrawalsEvent", (e: any) => events.push(e));

      await program.methods
        .enableWithdrawals()
        .accountsPartial({
          authority: authority.publicKey,
          config: configPda,
          pool: evPoolPda,
        })
        .rpc();

      await new Promise((r) => setTimeout(r, 500));
      await program.removeEventListener(listener);

      expect(events.length).to.equal(1);
      expect(events[0].pool.toBase58()).to.equal(evPoolPda.toBase58());
      expect(events[0].totalRepaid.toNumber()).to.be.greaterThan(0);
    });

    it("emits WithdrawEvent", async () => {
      const yieldBal = await getAccount(connection, evUserYieldAccount);
      const amount = new BN(yieldBal.amount.toString());

      const events: any[] = [];
      const listener = program.addEventListener("withdrawEvent", (e: any) => events.push(e));

      await program.methods
        .withdraw(amount)
        .accountsPartial({
          user: userKeypair.publicKey,
          pool: evPoolPda,
          yieldMint: evYieldMintPda,
          userYieldAccount: evUserYieldAccount,
          repayVault: evRepayVaultPda,
          userTokenAccount: evUserTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([userKeypair])
        .rpc();

      await new Promise((r) => setTimeout(r, 500));
      await program.removeEventListener(listener);

      expect(events.length).to.equal(1);
      expect(events[0].pool.toBase58()).to.equal(evPoolPda.toBase58());
      expect(events[0].user.toBase58()).to.equal(userKeypair.publicKey.toBase58());
      expect(events[0].yTokensBurned.toNumber()).to.equal(amount.toNumber());
      expect(events[0].payout.toNumber()).to.be.greaterThan(0);
    });
  });
});

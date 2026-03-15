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
});

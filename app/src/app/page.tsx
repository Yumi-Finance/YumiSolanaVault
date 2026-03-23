"use client";

import React, { useState, useCallback, useEffect } from "react";
import { BN } from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { useWallet } from "@solana/wallet-adapter-react";
import { useVaultClient, useNetwork } from "@/components/Providers";
import { VaultClient, VaultPoolAccount } from "@/lib/client";
import {
  lamportsToUi,
  shortAddress,
  formatTimestamp,
  poolFillPercent,
  daysToMaturity,
  depositDeadlineTs,
  userExpectedReturn,
  aprBpsToPercent,
} from "@/lib/client";
import { NETWORKS } from "@/lib/constants";

/* ---------- Pool Card ---------- */

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-zinc-500 text-xs">{label}</p>
      <p className="text-white font-medium text-sm">{value}</p>
      {sub && <p className="text-zinc-600 text-[10px] font-mono">{sub}</p>}
    </div>
  );
}

function PoolCard({
  pubkey,
  pool,
  userYieldBalance,
  onDeposit,
  onWithdraw,
}: {
  pubkey: PublicKey;
  pool: VaultPoolAccount;
  userYieldBalance: BN | null;
  onDeposit: (poolPk: PublicKey, pool: VaultPoolAccount) => void;
  onWithdraw: (poolPk: PublicKey, pool: VaultPoolAccount) => void;
}) {
  const matured = VaultClient.isMatured(pool.maturityTs);
  const depositOpen = VaultClient.isDepositOpen(pool.maturityTs, pool.depositDeadlineOffset);
  const apyPct = aprBpsToPercent(pool.aprBps);

  /* Progress bar: total deposited / pool cap */
  const fillPct = poolFillPercent(pool);

  /* Deposit deadline */
  const deadlineTs = depositDeadlineTs(pool);

  /* Time to maturity */
  const dtm = daysToMaturity(pool.maturityTs);

  /* User expected return */
  const expectedReturn = userExpectedReturn(userYieldBalance, pool);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Pool #{pool.poolId.toString()}
          </h3>
          <p className="text-xs text-zinc-500 font-mono">{shortAddress(pubkey)}</p>
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            matured
              ? "bg-emerald-900/60 text-emerald-400"
              : depositOpen
              ? "bg-indigo-900/60 text-indigo-400"
              : "bg-amber-900/60 text-amber-400"
          }`}
        >
          {matured ? "Matured" : depositOpen ? "Accepting Deposits" : "Deposit Closed"}
        </span>
      </div>

      {/* Pool capacity bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-zinc-400 mb-1">
          <span>{lamportsToUi(pool.totalDeposited, 6)} deposited</span>
          <span>{fillPct.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all"
            style={{ width: `${fillPct}%` }}
          />
        </div>
        <p className="text-[10px] text-zinc-600 mt-0.5">Cap: {lamportsToUi(pool.maxTotalDeposit, 6)}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <Stat label="APY" value={`${apyPct}%`} />
        <Stat label="Maturity" value={formatTimestamp(pool.maturityTs)} sub={matured ? "Matured" : `${dtm}d left`} />
        <Stat label="Min Deposit" value={lamportsToUi(pool.minDepositAmount, 6)} />
        <Stat
          label="Deposit Deadline"
          value={deadlineTs ? formatTimestamp(deadlineTs) : "At maturity"}
        />
        <Stat label="Total Deposited" value={lamportsToUi(pool.totalDeposited, 6)} />
        <Stat label="Total Expected Return" value={lamportsToUi(pool.totalExpectedReturn, 6)} />
        <Stat label="Total Repaid" value={lamportsToUi(pool.totalRepaid, 6)} />
        <Stat label="Remaining Repay" value={lamportsToUi(pool.remainingRepay, 6)} />
        <Stat label="Withdrawals" value={pool.withdrawalsEnabled ? "Enabled" : "Disabled"} />
        <Stat label="Whitelist" value={pool.whitelistEnabled ? "Required" : "Open"} />
      </div>

      {/* Mint addresses */}
      <div className="text-[10px] text-zinc-600 font-mono space-y-0.5 mb-4 border-t border-zinc-800 pt-3">
        <p>Deposit mint: {pool.depositMint.toBase58()}</p>
        <p>Yield mint: {pool.yieldMint.toBase58()}</p>
      </div>

      {/* User yToken info */}
      {userYieldBalance !== null && (
        <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-3 mb-4">
          <p className="text-xs text-zinc-400 mb-1">Your Position</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-zinc-500 text-xs">yToken Balance</p>
              <p className="text-white font-medium">{lamportsToUi(userYieldBalance, 6)}</p>
            </div>
            {expectedReturn && (
              <div>
                <p className="text-zinc-500 text-xs">Expected Return</p>
                <p className="text-emerald-400 font-medium">{lamportsToUi(expectedReturn, 6)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {depositOpen && !matured && (
          <button
            onClick={() => onDeposit(pubkey, pool)}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg py-2 transition"
          >
            Deposit
          </button>
        )}
        {pool.withdrawalsEnabled && (
          <button
            onClick={() => onWithdraw(pubkey, pool)}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg py-2 transition"
          >
            Withdraw
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Modal ---------- */

function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Main Page ---------- */

export default function Home() {
  const client = useVaultClient();
  const { publicKey } = useWallet();
  const { network } = useNetwork();

  const [pools, setPools] = useState<{ pubkey: PublicKey; account: VaultPoolAccount }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* Deposit modal */
  const [depositTarget, setDepositTarget] = useState<{
    pubkey: PublicKey;
    pool: VaultPoolAccount;
  } | null>(null);
  const [depositAmount, setDepositAmount] = useState("");

  /* Withdraw modal */
  const [withdrawTarget, setWithdrawTarget] = useState<{
    pubkey: PublicKey;
    pool: VaultPoolAccount;
  } | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const [txLoading, setTxLoading] = useState(false);

  /* yToken balances per pool (keyed by pool pubkey base58) */
  const [yieldBalances, setYieldBalances] = useState<Record<string, BN>>({});

  /* Load pools */
  const loadPools = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError("");
    try {
      const result = await client.fetchAllPools();
      setPools(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load pools");
    } finally {
      setLoading(false);
    }
  }, [client]);

  /* Load user yToken balances */
  useEffect(() => {
    if (!publicKey || pools.length === 0 || !client) {
      setYieldBalances({});
      return;
    }
    const conn = new Connection(NETWORKS[network].endpoint, "confirmed");
    let cancelled = false;

    (async () => {
      const balances: Record<string, BN> = {};
      await Promise.all(
        pools.map(async (p) => {
          try {
            const ata = getAssociatedTokenAddressSync(p.account.yieldMint, publicKey);
            const resp = await conn.getTokenAccountBalance(ata);
            balances[p.pubkey.toBase58()] = new BN(resp.value.amount);
          } catch {
            /* ATA doesn't exist = 0 balance, skip */
          }
        })
      );
      if (!cancelled) setYieldBalances(balances);
    })();

    return () => { cancelled = true; };
  }, [publicKey, pools, network, client]);

  React.useEffect(() => {
    loadPools();
  }, [loadPools, network]);

  /* Deposit */
  const handleDeposit = async () => {
    if (!client || !publicKey || !depositTarget) return;
    setTxLoading(true);
    setError("");
    setSuccess("");
    try {
      const amount = new BN(Math.floor(parseFloat(depositAmount) * 1e6));
      const pool = depositTarget.pool;

      const permit = pool.whitelistEnabled
        ? client.derivePermitAddress(depositTarget.pubkey, publicKey)
        : null;

      const ixs = await client.depositIxs(
        publicKey,
        depositTarget.pubkey,
        amount,
        permit
      );
      const sig = await client.send(...ixs);
      setSuccess(`Deposit successful! Tx: ${sig.slice(0, 16)}...`);
      setDepositTarget(null);
      setDepositAmount("");
      loadPools();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Deposit failed");
    } finally {
      setTxLoading(false);
    }
  };

  /* Withdraw */
  const handleWithdraw = async () => {
    if (!client || !publicKey || !withdrawTarget) return;
    setTxLoading(true);
    setError("");
    setSuccess("");
    try {
      const amount = new BN(Math.floor(parseFloat(withdrawAmount) * 1e6));

      const ixs = await client.withdrawIxs(
        publicKey,
        withdrawTarget.pubkey,
        amount
      );
      const sig = await client.send(...ixs);
      setSuccess(`Withdrawal successful! Tx: ${sig.slice(0, 16)}...`);
      setWithdrawTarget(null);
      setWithdrawAmount("");
      loadPools();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Withdrawal failed");
    } finally {
      setTxLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Vault Pools</h1>
        <button
          onClick={loadPools}
          disabled={loading || !client}
          className="text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg transition disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-900/40 border border-emerald-700 text-emerald-300 rounded-lg px-4 py-3 mb-4 text-sm">
          {success}
        </div>
      )}

      {!client && (
        <div className="text-center text-zinc-500 py-20">
          Connect your wallet to view pools
        </div>
      )}

      {client && pools.length === 0 && !loading && (
        <div className="text-center text-zinc-500 py-20">
          No pools found on {network}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {pools.map((p) => (
          <PoolCard
            key={p.pubkey.toBase58()}
            pubkey={p.pubkey}
            pool={p.account}
            userYieldBalance={yieldBalances[p.pubkey.toBase58()] ?? null}
            onDeposit={(pk, pool) => {
              setDepositTarget({ pubkey: pk, pool });
              setDepositAmount("");
            }}
            onWithdraw={(pk, pool) => {
              setWithdrawTarget({ pubkey: pk, pool });
              setWithdrawAmount("");
            }}
          />
        ))}
      </div>

      {/* Deposit Modal */}
      <Modal
        title={`Deposit to Pool #${depositTarget?.pool.poolId.toString() ?? ""}`}
        open={!!depositTarget}
        onClose={() => setDepositTarget(null)}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm text-zinc-400 block mb-1">
              Amount (tokens)
            </label>
            <input
              type="number"
              step="0.000001"
              min="0"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {depositTarget && (
            <p className="text-xs text-zinc-500">
              Min: {lamportsToUi(depositTarget.pool.minDepositAmount, 6)} · APY:{" "}
              {aprBpsToPercent(depositTarget.pool.aprBps)}%
            </p>
          )}
          <button
            onClick={handleDeposit}
            disabled={txLoading || !depositAmount}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition"
          >
            {txLoading ? "Sending..." : "Deposit"}
          </button>
        </div>
      </Modal>

      {/* Withdraw Modal */}
      <Modal
        title={`Withdraw from Pool #${withdrawTarget?.pool.poolId.toString() ?? ""}`}
        open={!!withdrawTarget}
        onClose={() => setWithdrawTarget(null)}
      >
        <div className="space-y-4">
          {withdrawTarget && yieldBalances[withdrawTarget.pubkey.toBase58()] && (
            <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-3">
              <p className="text-xs text-zinc-400">Your yToken balance</p>
              <p className="text-white font-medium">
                {lamportsToUi(yieldBalances[withdrawTarget.pubkey.toBase58()], 6)}
              </p>
            </div>
          )}
          <div>
            <label className="text-sm text-zinc-400 block mb-1">
              Amount (yield tokens to burn)
            </label>
            <input
              type="number"
              step="0.000001"
              min="0"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {withdrawTarget && yieldBalances[withdrawTarget.pubkey.toBase58()] && (
              <button
                className="text-xs text-indigo-400 hover:text-indigo-300 mt-1"
                onClick={() => setWithdrawAmount(
                  lamportsToUi(yieldBalances[withdrawTarget.pubkey.toBase58()], 6)
                )}
              >
                Max
              </button>
            )}
          </div>
          <button
            onClick={handleWithdraw}
            disabled={txLoading || !withdrawAmount}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition"
          >
            {txLoading ? "Sending..." : "Withdraw"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

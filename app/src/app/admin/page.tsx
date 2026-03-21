"use client";

import React, { useState, useCallback } from "react";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { useWallet } from "@solana/wallet-adapter-react";
import { useVaultClient, useNetwork } from "@/components/Providers";
import { VaultPoolAccount, VaultClient, ProtocolConfigAccount } from "@/lib/client";
import {
  lamportsToUi,
  shortAddress,
  formatTimestamp,
  poolFillPercent,
  daysToMaturity,
  depositDeadlineTs,
  apyBpsToPercent,
  uiToLamports,
  SWEEP_GRACE_SECONDS,
} from "@/lib/client";

/* ---------- Section wrapper ---------- */

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-zinc-800/50 transition"
      >
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <span className="text-zinc-500 text-lg">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="px-6 pb-6 pt-2">{children}</div>}
    </div>
  );
}

/* ---------- Input helpers ---------- */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm text-zinc-400 block mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
const btnPrimary =
  "bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 px-5 transition text-sm";
const btnDanger =
  "bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 px-5 transition text-sm";
const btnSuccess =
  "bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 px-5 transition text-sm";

const POOLS_PER_PAGE = 5;

/* ---------- Collapsible Pool Row ---------- */

function PoolRow({ pubkey, pool }: { pubkey: PublicKey; pool: VaultPoolAccount }) {
  const [expanded, setExpanded] = useState(false);
  const matured = VaultClient.isMatured(pool.maturityTs);
  const depositOpen = VaultClient.isDepositOpen(pool.maturityTs, pool.depositDeadlineOffset);
  const dtm = daysToMaturity(pool.maturityTs);
  const fillPct = poolFillPercent(pool);
  const deadlineTs = depositDeadlineTs(pool);

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
      {/* Summary row — always visible, clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/80 transition text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-white font-semibold text-sm shrink-0">
            Pool #{pool.poolId.toString()}
          </span>
          <span className="text-xs text-zinc-500">{apyBpsToPercent(pool.apyBps)}% APY</span>
          <span className="text-xs text-zinc-500">·</span>
          <span className="text-xs text-zinc-500">{lamportsToUi(pool.totalDeposited, 6)} deposited</span>
          {/* Mini fill bar */}
          <div className="hidden sm:block w-16 h-1 bg-zinc-700 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${fillPct}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full ${
              matured
                ? "bg-emerald-900/60 text-emerald-400"
                : depositOpen
                ? "bg-indigo-900/60 text-indigo-400"
                : "bg-amber-900/60 text-amber-400"
            }`}
          >
            {matured ? "Matured" : depositOpen ? "Open" : "Closed"}
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full ${
              pool.withdrawalsEnabled
                ? "bg-emerald-900/60 text-emerald-400"
                : "bg-zinc-700 text-zinc-400"
            }`}
          >
            {pool.withdrawalsEnabled ? "W:On" : "W:Off"}
          </span>
          {pool.whitelistEnabled && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-900/60 text-violet-400">WL</span>
          )}
          {pool.allowOverpay && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-400">Overpay</span>
          )}
          <span className="text-zinc-500 text-sm ml-1">{expanded ? "−" : "+"}</span>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-zinc-700/50">
          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>Deposited: {lamportsToUi(pool.totalDeposited, 6)}</span>
              <span>{fillPct.toFixed(1)}% of {lamportsToUi(pool.maxTotalDeposit, 6)}</span>
            </div>
            <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${fillPct}%` }} />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-x-4 gap-y-2 text-xs mb-3">
            <div>
              <span className="text-zinc-500">APY</span>
              <p className="text-zinc-200 font-medium">{apyBpsToPercent(pool.apyBps)}%</p>
            </div>
            <div>
              <span className="text-zinc-500">Maturity</span>
              <p className="text-zinc-200">{formatTimestamp(pool.maturityTs)}</p>
              <p className="text-zinc-600 text-[10px]">{matured ? "Matured" : `${dtm}d remaining`}</p>
            </div>
            <div>
              <span className="text-zinc-500">Deposit Deadline</span>
              <p className="text-zinc-200">{deadlineTs ? formatTimestamp(deadlineTs) : "At maturity"}</p>
            </div>
            <div>
              <span className="text-zinc-500">Min Deposit</span>
              <p className="text-zinc-200">{lamportsToUi(pool.minDepositAmount, 6)}</p>
            </div>
            <div>
              <span className="text-zinc-500">Pool Cap</span>
              <p className="text-zinc-200">{lamportsToUi(pool.maxTotalDeposit, 6)}</p>
            </div>
            <div>
              <span className="text-zinc-500">Total Expected Return</span>
              <p className="text-zinc-200">{lamportsToUi(pool.totalExpectedReturn, 6)}</p>
            </div>
            <div>
              <span className="text-zinc-500">Total Repaid</span>
              <p className="text-zinc-200">{lamportsToUi(pool.totalRepaid, 6)}</p>
            </div>
            <div>
              <span className="text-zinc-500">Admin Withdrawn</span>
              <p className="text-zinc-200">{lamportsToUi(pool.totalAdminWithdrawn, 6)}</p>
            </div>
            <div>
              <span className="text-zinc-500">Remaining Repay</span>
              <p className={`font-medium ${pool.remainingRepay.gtn(0) ? "text-amber-400" : "text-emerald-400"}`}>
                {lamportsToUi(pool.remainingRepay, 6)}
              </p>
            </div>
          </div>

          {/* Addresses */}
          <div className="text-[10px] text-zinc-600 font-mono space-y-0.5 border-t border-zinc-700 pt-2">
            <p>Pool: {pubkey.toBase58()}</p>
            <p>Deposit Mint: {pool.depositMint.toBase58()}</p>
            <p>Yield Mint: {pool.yieldMint.toBase58()}</p>
            <p>Deposit Vault: {pool.depositVault.toBase58()}</p>
            <p>Repay Vault: {pool.repayVault.toBase58()}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Pool List with pagination ---------- */

function PoolList({ pools }: { pools: { pubkey: PublicKey; account: VaultPoolAccount }[] }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(pools.length / POOLS_PER_PAGE);
  const visible = pools.slice(page * POOLS_PER_PAGE, (page + 1) * POOLS_PER_PAGE);

  return (
    <div>
      <div className="space-y-2">
        {visible.map((p) => (
          <PoolRow key={p.pubkey.toBase58()} pubkey={p.pubkey} pool={p.account} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-800">
          <button
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
            disabled={page === 0}
            className="text-sm text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition px-3 py-1"
          >
            ← Prev
          </button>
          <span className="text-xs text-zinc-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
            disabled={page >= totalPages - 1}
            className="text-sm text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition px-3 py-1"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Admin Page ---------- */

export default function AdminPage() {
  const client = useVaultClient();
  const { publicKey } = useWallet();
  const { network } = useNetwork();

  const [config, setConfig] = useState<ProtocolConfigAccount | null>(null);
  const [pools, setPools] = useState<{ pubkey: PublicKey; account: VaultPoolAccount }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [txLoading, setTxLoading] = useState(false);

  /* config + pool loading */
  const refresh = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError("");
    try {
      const [cfg, poolList] = await Promise.all([
        client.fetchConfigOrNull(),
        client.fetchAllPools(),
      ]);
      setConfig(cfg);
      setPools(poolList);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [client]);

  React.useEffect(() => {
    refresh();
  }, [refresh, network]);

  /* generic tx helper */
  const execTx = async (
    label: string,
    fn: () => Promise<string>
  ) => {
    setTxLoading(true);
    setError("");
    setSuccess("");
    try {
      const sig = await fn();
      setSuccess(`${label} successful! Tx: ${sig.slice(0, 16)}...`);
      refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : `${label} failed`);
    } finally {
      setTxLoading(false);
    }
  };

  /* ============ Init Config ============ */
  const handleInitConfig = () => {
    if (!client || !publicKey) return;
    execTx("Init Config", async () => {
      const ix = await client.initConfigIx(publicKey);
      return client.send(ix);
    });
  };

  /* ============ Propose Authority ============ */
  const [newAuthority, setNewAuthority] = useState("");
  const handleProposeAuthority = () => {
    if (!client || !publicKey || !newAuthority) return;
    execTx("Propose Authority", async () => {
      const ix = await client.proposeAuthorityIx(
        publicKey,
        new PublicKey(newAuthority)
      );
      return client.send(ix);
    });
  };

  const handleAcceptAuthority = () => {
    if (!client || !publicKey) return;
    execTx("Accept Authority", async () => {
      const ix = await client.acceptAuthorityIx(publicKey);
      return client.send(ix);
    });
  };

  /* ============ Create Pool ============ */
  const [cpPoolId, setCpPoolId] = useState("");
  const [cpApyBps, setCpApyBps] = useState("");
  const [cpMaturityDate, setCpMaturityDate] = useState("");
  const [cpDeadlineOffset, setCpDeadlineOffset] = useState("0");
  const [cpMinDeposit, setCpMinDeposit] = useState("");
  const [cpMaxDeposit, setCpMaxDeposit] = useState("");
  const [cpMintAddr, setCpMintAddr] = useState("");
  const [cpWhitelist, setCpWhitelist] = useState(false);

  const handleCreatePool = () => {
    if (!client || !publicKey) return;
    execTx("Create Pool", async () => {
      // Validate the mint exists and is a real SPL token
      let mintPubkey: PublicKey;
      try {
        mintPubkey = new PublicKey(cpMintAddr);
      } catch {
        throw new Error("Invalid mint address");
      }
      const mintInfo = await client["program"].provider.connection.getAccountInfo(mintPubkey);
      if (!mintInfo) {
        throw new Error(`Mint ${cpMintAddr.slice(0, 8)}... does not exist on ${network}`);
      }
      const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
      if (mintInfo.owner.toBase58() !== TOKEN_PROGRAM_ID) {
        throw new Error(`Address is not an SPL token mint (owner: ${mintInfo.owner.toBase58().slice(0, 8)}...)`);
      }
      const maturityTs = Math.floor(new Date(cpMaturityDate).getTime() / 1000);
      const ix = await client.initPoolIx(publicKey, mintPubkey, {
        poolId: new BN(cpPoolId),
        apyBps: parseInt(cpApyBps),
        maturityTs: new BN(maturityTs),
        depositDeadlineOffset: new BN(cpDeadlineOffset),
        minDepositAmount: new BN(Math.floor(parseFloat(cpMinDeposit) * 1e6)),
        maxTotalDeposit: new BN(Math.floor(parseFloat(cpMaxDeposit) * 1e6)),
        whitelistEnabled: cpWhitelist,
      });
      return client.send(ix);
    });
  };


  /* ============ Update Pool ============ */
  const [upPoolAddr, setUpPoolAddr] = useState("");
  const [upApyBps, setUpApyBps] = useState("");
  const [upMinDeposit, setUpMinDeposit] = useState("");
  const [upMaxDeposit, setUpMaxDeposit] = useState("");
  const [upAllowOverpay, setUpAllowOverpay] = useState(false);

  const handleUpdatePool = () => {
    if (!client || !publicKey || !upPoolAddr) return;
    execTx("Update Pool", async () => {
      const ix = await client.updatePoolIx(
        publicKey,
        new PublicKey(upPoolAddr),
        {
          apyBps: upApyBps ? parseInt(upApyBps) : null,
          minDepositAmount: upMinDeposit
            ? new BN(Math.floor(parseFloat(upMinDeposit) * 1e6))
            : null,
          maxTotalDeposit: upMaxDeposit
            ? new BN(Math.floor(parseFloat(upMaxDeposit) * 1e6))
            : null,
          allowOverpay: upAllowOverpay ? true : null,
        }
      );
      return client.send(ix);
    });
  };

  /* ============ Admin Withdraw ============ */
  const [awPoolAddr, setAwPoolAddr] = useState("");
  const [awAmount, setAwAmount] = useState("");

  const handleAdminWithdraw = () => {
    if (!client || !publicKey || !awPoolAddr) return;
    execTx("Admin Withdraw", async () => {
      const poolData = await client.fetchPool(new PublicKey(awPoolAddr));
      const adminToken = getAssociatedTokenAddressSync(poolData.depositMint, publicKey);
      const ix = await client.adminWithdrawIx(
        publicKey,
        new PublicKey(awPoolAddr),
        new BN(Math.floor(parseFloat(awAmount) * 1e6)),
        adminToken
      );
      return client.send(ix);
    });
  };

  /* ============ Repay ============ */
  const [rpPoolAddr, setRpPoolAddr] = useState("");
  const [rpAmount, setRpAmount] = useState("");

  const handleRepay = () => {
    if (!client || !publicKey || !rpPoolAddr) return;
    execTx("Repay", async () => {
      const poolData = await client.fetchPool(new PublicKey(rpPoolAddr));
      const adminToken = getAssociatedTokenAddressSync(poolData.depositMint, publicKey);
      const ix = await client.repayIx(
        publicKey,
        new PublicKey(rpPoolAddr),
        new BN(Math.floor(parseFloat(rpAmount) * 1e6)),
        adminToken
      );
      return client.send(ix);
    });
  };

  /* ============ Enable Withdrawals ============ */
  const [ewPoolAddr, setEwPoolAddr] = useState("");

  const handleEnableWithdrawals = () => {
    if (!client || !publicKey || !ewPoolAddr) return;
    execTx("Enable Withdrawals", async () => {
      const ix = await client.enableWithdrawalsIx(
        publicKey,
        new PublicKey(ewPoolAddr)
      );
      return client.send(ix);
    });
  };

  /* ============ Sweep Repay Vault ============ */
  const [swPoolAddr, setSwPoolAddr] = useState("");

  const handleSweepRepayVault = () => {
    if (!client || !publicKey || !swPoolAddr) return;
    execTx("Sweep Repay Vault", async () => {
      const pool = new PublicKey(swPoolAddr);
      const poolData = await client.fetchPool(pool);
      const adminToken = getAssociatedTokenAddressSync(poolData.depositMint, publicKey);
      const ix = await client.sweepRepayVaultIx(publicKey, pool, adminToken);
      return client.send(ix);
    });
  };

  /* ============ Grant Permit ============ */
  const [gpPoolAddr, setGpPoolAddr] = useState("");
  const [gpUser, setGpUser] = useState("");
  const [gpMaxAmount, setGpMaxAmount] = useState("0");
  const [gpExpiresAt, setGpExpiresAt] = useState("0");

  const handleGrantPermit = () => {
    if (!client || !publicKey || !gpPoolAddr || !gpUser) return;
    execTx("Grant Permit", async () => {
      const ix = await client.grantPermitIx(
        publicKey,
        new PublicKey(gpPoolAddr),
        new PublicKey(gpUser),
        new BN(Math.floor(parseFloat(gpMaxAmount) * 1e6)),
        new BN(gpExpiresAt)
      );
      return client.send(ix);
    });
  };

  /* ============ Revoke Permit ============ */
  const [rvPoolAddr, setRvPoolAddr] = useState("");
  const [rvUser, setRvUser] = useState("");

  const handleRevokePermit = () => {
    if (!client || !publicKey || !rvPoolAddr || !rvUser) return;
    execTx("Revoke Permit", async () => {
      const pool = new PublicKey(rvPoolAddr);
      const user = new PublicKey(rvUser);
      const permit = client.derivePermitAddress(pool, user);
      const ix = await client.revokePermitIx(publicKey, pool, permit);
      return client.send(ix);
    });
  };

  /* Pool select options */
  const poolOptions = pools.map((p) => ({
    label: `Pool #${p.account.poolId.toString()} (${shortAddress(p.pubkey)})`,
    value: p.pubkey.toBase58(),
  }));

  function PoolSelect({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      >
        <option value="">Select pool...</option>
        {poolOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  /* Find selected pool data */
  function selectedPool(addr: string): VaultPoolAccount | undefined {
    if (!addr) return undefined;
    return pools.find((p) => p.pubkey.toBase58() === addr)?.account;
  }

  /* ============ Render ============ */

  if (!client) {
    return (
      <div className="text-center text-zinc-500 py-20">
        Connect your wallet to access the admin panel
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg transition disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-900/40 border border-emerald-700 text-emerald-300 rounded-lg px-4 py-3 text-sm">
          {success}
        </div>
      )}

      {/* Protocol Config Status */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-400 mb-1">Protocol Config</p>
            {config ? (
              <div className="space-y-1">
                <p className="text-sm text-white">
                  Authority: <span className="font-mono text-xs">{config.authority.toBase58()}</span>
                </p>
                <p className="text-xs text-zinc-500">
                  Connected as: <span className="font-mono">{publicKey?.toBase58()}</span>
                  {publicKey && config.authority.equals(publicKey) ? (
                    <span className="text-emerald-400 ml-2">You are the authority</span>
                  ) : (
                    <span className="text-red-400 ml-2">Not authority — admin actions will fail</span>
                  )}
                </p>
                <p className="text-xs text-zinc-600">
                  Network: {network} · Pools: {pools.length}
                </p>
                {config.pendingAuthority && (
                  <p className="text-xs text-amber-400">
                    Pending Authority: <span className="font-mono">{config.pendingAuthority.toBase58()}</span>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-amber-400">Not initialized</p>
            )}
          </div>
          {!config && (
            <button
              onClick={handleInitConfig}
              disabled={txLoading}
              className={btnPrimary}
            >
              Initialize Config
            </button>
          )}
        </div>
      </div>

      {/* Transfer Authority (Two-step) */}
      <Section title="Transfer Authority">
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">Two-step process: propose a new authority, then the new authority must accept.</p>
          <Field label="New Authority Address">
            <input
              className={inputCls}
              placeholder="Pubkey..."
              value={newAuthority}
              onChange={(e) => setNewAuthority(e.target.value)}
            />
          </Field>
          <div className="flex gap-3">
            <button
              onClick={handleProposeAuthority}
              disabled={txLoading || !newAuthority}
              className={btnDanger}
            >
              Propose Authority
            </button>
            <button
              onClick={handleAcceptAuthority}
              disabled={txLoading || !(config?.pendingAuthority && publicKey && config.pendingAuthority.equals(publicKey))}
              className={btnPrimary}
            >
              Accept Authority
            </button>
          </div>
        </div>
      </Section>

      {/* Create Pool */}
      <Section title="Create Pool" defaultOpen>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pool ID">
            <input
              className={inputCls}
              type="number"
              placeholder="1"
              value={cpPoolId}
              onChange={(e) => setCpPoolId(e.target.value)}
            />
          </Field>
          <Field label="APY (basis points)">
            <input
              className={inputCls}
              type="number"
              placeholder="800 = 8%"
              value={cpApyBps}
              onChange={(e) => setCpApyBps(e.target.value)}
            />
          </Field>
          <Field label="Maturity Date">
            <input
              className={inputCls}
              type="datetime-local"
              value={cpMaturityDate}
              onChange={(e) => setCpMaturityDate(e.target.value)}
            />
          </Field>
          <Field label="Deposit Deadline Offset (sec)">
            <input
              className={inputCls}
              type="number"
              placeholder="0"
              value={cpDeadlineOffset}
              onChange={(e) => setCpDeadlineOffset(e.target.value)}
            />
          </Field>
          <Field label="Min Deposit (tokens)">
            <input
              className={inputCls}
              type="number"
              step="0.000001"
              placeholder="1.0"
              value={cpMinDeposit}
              onChange={(e) => setCpMinDeposit(e.target.value)}
            />
          </Field>
          <Field label="Max Total Deposit (tokens)">
            <input
              className={inputCls}
              type="number"
              step="0.000001"
              placeholder="1000000"
              value={cpMaxDeposit}
              onChange={(e) => setCpMaxDeposit(e.target.value)}
            />
          </Field>
          <Field label="Deposit Mint Address">
            <input
              className={inputCls}
              placeholder={network === "devnet" ? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU (devnet USDC)" : "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v (mainnet USDC)"}
              value={cpMintAddr}
              onChange={(e) => setCpMintAddr(e.target.value)}
            />
          </Field>
          <Field label="Whitelist">
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={cpWhitelist}
                onChange={(e) => setCpWhitelist(e.target.checked)}
                className="rounded border-zinc-600 bg-zinc-800"
              />
              <span className="text-sm text-zinc-300">Enable whitelist</span>
            </label>
          </Field>
        </div>
        <button
          onClick={handleCreatePool}
          disabled={txLoading || !cpPoolId || !cpMintAddr}
          className={`${btnPrimary} mt-4`}
        >
          Create Pool
        </button>
      </Section>

      {/* Existing Pools */}
      <Section title={`Pools (${pools.length})`} defaultOpen>
        {pools.length === 0 ? (
          <p className="text-sm text-zinc-500">No pools found</p>
        ) : (
          <PoolList pools={pools} />
        )}
      </Section>

      {/* Update Pool */}
      <Section title="Update Pool">
        <div className="space-y-3">
          <Field label="Pool">
            <PoolSelect value={upPoolAddr} onChange={setUpPoolAddr} />
          </Field>
          {(() => {
            const sp = selectedPool(upPoolAddr);
            if (!sp) return null;
            return (
              <div className="bg-zinc-800/40 rounded-lg p-3 text-xs text-zinc-400 grid grid-cols-3 gap-2">
                <div>Current APY: <span className="text-white">{apyBpsToPercent(sp.apyBps)}%</span></div>
                <div>Current Min: <span className="text-white">{lamportsToUi(sp.minDepositAmount, 6)}</span></div>
                <div>Current Cap: <span className="text-white">{lamportsToUi(sp.maxTotalDeposit, 6)}</span></div>
              </div>
            );
          })()}
          <div className="grid grid-cols-3 gap-3">
            <Field label="New APY (bps, optional)">
              <input
                className={inputCls}
                type="number"
                placeholder="Leave empty to skip"
                value={upApyBps}
                onChange={(e) => setUpApyBps(e.target.value)}
              />
            </Field>
            <Field label="Min Deposit (optional)">
              <input
                className={inputCls}
                type="number"
                step="0.000001"
                placeholder="Leave empty to skip"
                value={upMinDeposit}
                onChange={(e) => setUpMinDeposit(e.target.value)}
              />
            </Field>
            <Field label="Max Deposit (optional)">
              <input
                className={inputCls}
                type="number"
                step="0.000001"
                placeholder="Leave empty to skip"
                value={upMaxDeposit}
                onChange={(e) => setUpMaxDeposit(e.target.value)}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={upAllowOverpay}
                onChange={(e) => setUpAllowOverpay(e.target.checked)}
              />
              Allow overpay (irreversible)
            </label>
          </div>
          <button
            onClick={handleUpdatePool}
            disabled={txLoading || !upPoolAddr}
            className={btnPrimary}
          >
            Update Pool
          </button>
        </div>
      </Section>

      {/* Admin Withdraw */}
      <Section title="Admin Withdraw (from Deposit Vault)">
        <div className="space-y-3">
          <Field label="Pool">
            <PoolSelect value={awPoolAddr} onChange={setAwPoolAddr} />
          </Field>
          {(() => {
            const sp = selectedPool(awPoolAddr);
            if (!sp) return null;
            return (
              <div className="bg-zinc-800/40 rounded-lg p-3 text-xs text-zinc-400 grid grid-cols-2 gap-2">
                <div>Total Deposited: <span className="text-white">{lamportsToUi(sp.totalDeposited, 6)}</span></div>
                <div>Admin Withdrawn: <span className="text-white">{lamportsToUi(sp.totalAdminWithdrawn, 6)}</span></div>
                <div>Available to Withdraw: <span className="text-amber-400 font-medium">{lamportsToUi(sp.totalDeposited.sub(sp.totalAdminWithdrawn), 6)}</span></div>
                <div>Deposit Vault: <span className="text-white font-mono text-[10px]">{sp.depositVault.toBase58()}</span></div>
              </div>
            );
          })()}
          <Field label="Amount (tokens)">
            <input
              className={inputCls}
              type="number"
              step="0.000001"
              placeholder="0.00"
              value={awAmount}
              onChange={(e) => setAwAmount(e.target.value)}
            />
          </Field>
          <button
            onClick={handleAdminWithdraw}
            disabled={txLoading || !awPoolAddr || !awAmount}
            className={btnDanger}
          >
            Admin Withdraw
          </button>
        </div>
      </Section>

      {/* Repay */}
      <Section title="Repay (to Repay Vault)">
        <div className="space-y-3">
          <Field label="Pool">
            <PoolSelect value={rpPoolAddr} onChange={setRpPoolAddr} />
          </Field>
          {(() => {
            const sp = selectedPool(rpPoolAddr);
            if (!sp) return null;
            return (
              <div className="bg-zinc-800/40 rounded-lg p-3 text-xs text-zinc-400 grid grid-cols-3 gap-2">
                <div>Remaining Repay: <span className={`font-medium ${sp.remainingRepay.gtn(0) ? "text-amber-400" : "text-emerald-400"}`}>{lamportsToUi(sp.remainingRepay, 6)}</span></div>
                <div>Total Repaid: <span className="text-white">{lamportsToUi(sp.totalRepaid, 6)}</span></div>
                <div>Total Expected Return: <span className="text-white">{lamportsToUi(sp.totalExpectedReturn, 6)}</span></div>
              </div>
            );
          })()}
          <Field label="Amount (tokens)">
            <input
              className={inputCls}
              type="number"
              step="0.000001"
              placeholder="0.00"
              value={rpAmount}
              onChange={(e) => setRpAmount(e.target.value)}
            />
          </Field>
          <button
            onClick={handleRepay}
            disabled={txLoading || !rpPoolAddr || !rpAmount}
            className={btnSuccess}
          >
            Repay
          </button>
        </div>
      </Section>

      {/* Enable Withdrawals */}
      <Section title="Enable Withdrawals">
        <div className="space-y-3">
          <Field label="Pool">
            <PoolSelect value={ewPoolAddr} onChange={setEwPoolAddr} />
          </Field>
          {(() => {
            const sp = selectedPool(ewPoolAddr);
            if (!sp) return null;
            return (
              <div className="bg-zinc-800/40 rounded-lg p-3 text-xs text-zinc-400 grid grid-cols-3 gap-2">
                <div>Status: <span className={sp.withdrawalsEnabled ? "text-emerald-400" : "text-amber-400"}>{sp.withdrawalsEnabled ? "Already enabled" : "Disabled"}</span></div>
                <div>Remaining Repay: <span className={`font-medium ${sp.remainingRepay.gtn(0) ? "text-amber-400" : "text-emerald-400"}`}>{lamportsToUi(sp.remainingRepay, 6)}</span></div>
                <div>Matured: <span className={VaultClient.isMatured(sp.maturityTs) ? "text-emerald-400" : "text-zinc-300"}>{VaultClient.isMatured(sp.maturityTs) ? "Yes" : "No"}</span></div>
              </div>
            );
          })()}
          <button
            onClick={handleEnableWithdrawals}
            disabled={txLoading || !ewPoolAddr}
            className={btnSuccess}
          >
            Enable Withdrawals
          </button>
        </div>
      </Section>

      {/* Sweep Repay Vault */}
      <Section title="Sweep Repay Vault (L-3)">
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">
            Recover orphaned repay funds after {SWEEP_GRACE_SECONDS / 86400} days post-maturity.
            Covers yTokens sent to unreachable addresses.
          </p>
          <Field label="Pool">
            <PoolSelect value={swPoolAddr} onChange={setSwPoolAddr} />
          </Field>
          {(() => {
            const sp = selectedPool(swPoolAddr);
            if (!sp) return null;
            const sweepAfter = sp.maturityTs.addn(SWEEP_GRACE_SECONDS);
            const nowBn = new BN(Math.floor(Date.now() / 1000));
            const canSweep = nowBn.gte(sweepAfter) && sp.withdrawalsEnabled && sp.remainingRepay.gtn(0);
            return (
              <div className="bg-zinc-800/40 rounded-lg p-3 text-xs text-zinc-400 grid grid-cols-2 gap-2">
                <div>Remaining Repay: <span className={`font-medium ${sp.remainingRepay.gtn(0) ? "text-amber-400" : "text-emerald-400"}`}>{lamportsToUi(sp.remainingRepay, 6)}</span></div>
                <div>Sweep Available: <span className={canSweep ? "text-emerald-400" : "text-amber-400"}>{canSweep ? "Yes" : `After ${formatTimestamp(sweepAfter)}`}</span></div>
                <div>Withdrawals: <span className={sp.withdrawalsEnabled ? "text-emerald-400" : "text-amber-400"}>{sp.withdrawalsEnabled ? "Enabled" : "Disabled"}</span></div>
              </div>
            );
          })()}
          <button
            onClick={handleSweepRepayVault}
            disabled={txLoading || !swPoolAddr}
            className={btnDanger}
          >
            Sweep Repay Vault
          </button>
        </div>
      </Section>

      {/* Grant Permit */}
      <Section title="Grant Deposit Permit">
        <div className="space-y-3">
          <Field label="Pool">
            <PoolSelect value={gpPoolAddr} onChange={setGpPoolAddr} />
          </Field>
          <Field label="User Address">
            <input
              className={inputCls}
              placeholder="User pubkey..."
              value={gpUser}
              onChange={(e) => setGpUser(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Max Amount (tokens, 0 = unlimited)">
              <input
                className={inputCls}
                type="number"
                step="0.000001"
                value={gpMaxAmount}
                onChange={(e) => setGpMaxAmount(e.target.value)}
              />
            </Field>
            <Field label="Expires At (unix ts, 0 = none)">
              <input
                className={inputCls}
                type="number"
                value={gpExpiresAt}
                onChange={(e) => setGpExpiresAt(e.target.value)}
              />
            </Field>
          </div>
          <button
            onClick={handleGrantPermit}
            disabled={txLoading || !gpPoolAddr || !gpUser}
            className={btnPrimary}
          >
            Grant Permit
          </button>
        </div>
      </Section>

      {/* Revoke Permit */}
      <Section title="Revoke Deposit Permit">
        <div className="space-y-3">
          <Field label="Pool">
            <PoolSelect value={rvPoolAddr} onChange={setRvPoolAddr} />
          </Field>
          <Field label="User Address">
            <input
              className={inputCls}
              placeholder="User pubkey..."
              value={rvUser}
              onChange={(e) => setRvUser(e.target.value)}
            />
          </Field>
          <button
            onClick={handleRevokePermit}
            disabled={txLoading || !rvPoolAddr || !rvUser}
            className={btnDanger}
          >
            Revoke Permit
          </button>
        </div>
      </Section>
    </div>
  );
}

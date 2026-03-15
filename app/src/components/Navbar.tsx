"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import NetworkSwitcher from "./NetworkSwitcher";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (m) => m.WalletMultiButton
    ),
  { ssr: false }
);

export default function Navbar() {
  const pathname = usePathname();
  const isAdmin = pathname === "/admin";

  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-xl font-bold text-white tracking-tight">
          Yumi Vaults
        </Link>
        <div className="flex gap-1">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              !isAdmin
                ? "bg-indigo-600 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Pools
          </Link>
          <Link
            href="/admin"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              isAdmin
                ? "bg-indigo-600 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Admin
          </Link>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <NetworkSwitcher />
        <WalletMultiButton />
      </div>
    </nav>
  );
}

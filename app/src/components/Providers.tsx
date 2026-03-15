"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  ReactNode,
} from "react";
import {
  ConnectionProvider,
  WalletProvider as SolWalletProvider,
  useAnchorWallet,
  useConnection,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";

import { AppVaultClient } from "@/lib/client";
import { NETWORKS, DEFAULT_NETWORK, NetworkName } from "@/lib/constants";

/* ---------- Network context ---------- */

interface NetworkCtx {
  network: NetworkName;
  setNetwork: (n: NetworkName) => void;
}

const NetworkContext = createContext<NetworkCtx>({
  network: DEFAULT_NETWORK,
  setNetwork: () => {},
});

export const useNetwork = () => useContext(NetworkContext);

/* ---------- Vault client context ---------- */

const VaultClientContext = createContext<AppVaultClient | null>(null);
export const useVaultClient = () => useContext(VaultClientContext);

/* ---------- Inner (needs connection + wallet) ---------- */

function VaultClientProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const client = useMemo(() => {
    if (!wallet) return null;
    return new AppVaultClient(connection, wallet);
  }, [connection, wallet]);

  return (
    <VaultClientContext.Provider value={client}>
      {children}
    </VaultClientContext.Provider>
  );
}

/* ---------- Root provider ---------- */

export default function Providers({ children }: { children: ReactNode }) {
  const [network, setNetworkRaw] = useState<NetworkName>(DEFAULT_NETWORK);

  const setNetwork = useCallback((n: NetworkName) => setNetworkRaw(n), []);

  const endpoint = useMemo(() => NETWORKS[network].endpoint, [network]);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <NetworkContext.Provider value={{ network, setNetwork }}>
      <ConnectionProvider endpoint={endpoint}>
        <SolWalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <VaultClientProvider>{children}</VaultClientProvider>
          </WalletModalProvider>
        </SolWalletProvider>
      </ConnectionProvider>
    </NetworkContext.Provider>
  );
}

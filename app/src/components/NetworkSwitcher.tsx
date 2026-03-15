"use client";

import React from "react";
import { useNetwork } from "./Providers";
import { NETWORKS, NetworkName } from "@/lib/constants";

export default function NetworkSwitcher() {
  const { network, setNetwork } = useNetwork();

  return (
    <select
      value={network}
      onChange={(e) => setNetwork(e.target.value as NetworkName)}
      className="bg-zinc-800 text-sm text-zinc-200 border border-zinc-600 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      {(Object.keys(NETWORKS) as NetworkName[]).map((n) => (
        <option key={n} value={n}>
          {NETWORKS[n].label}
        </option>
      ))}
    </select>
  );
}

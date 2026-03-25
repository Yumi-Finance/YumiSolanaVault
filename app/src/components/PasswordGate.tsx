"use client";

import React, { useState, useEffect, useCallback } from "react";

const PASS_HASH = process.env.NEXT_PUBLIC_PASS_HASH ?? "";
const STORAGE_KEY = "yumi_authed";

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new Uint8Array(new TextEncoder().encode(text)),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function PasswordGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    setAuthed(sessionStorage.getItem(STORAGE_KEY) === "1");
    setChecking(false);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const hash = await sha256(input);
      if (hash === PASS_HASH) {
        sessionStorage.setItem(STORAGE_KEY, "1");
        setAuthed(true);
        setError(false);
      } else {
        setError(true);
      }
    },
    [input],
  );

  if (checking) return null;
  if (authed) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xs flex flex-col gap-4"
      >
        <h1 className="text-xl font-semibold text-white text-center">
          Yumi Vaults
        </h1>
        <p className="text-zinc-500 text-sm text-center">
          Enter password to continue
        </p>
        <input
          type="password"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(false);
          }}
          placeholder="Password"
          autoFocus
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500 transition"
        />
        {error && (
          <p className="text-red-500 text-xs text-center">Wrong password</p>
        )}
        <button
          type="submit"
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition"
        >
          Enter
        </button>
      </form>
    </div>
  );
}
